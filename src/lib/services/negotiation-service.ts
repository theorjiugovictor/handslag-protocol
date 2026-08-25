/**
 * NegotiationService
 *
 * DB-backed negotiation lifecycle manager and FSM orchestrator.
 * Encapsulates state transitions, DB persistence via Prisma,
 * claim verification, and multi-party event broadcasting.
 */

import prisma from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { VALID_TRANSITIONS, type NegotiationState, type SettlementProposal } from '@/lib/types/negotiation';
import { broadcastToNegotiation } from './event-bus';
import { createSignedClaim, generateAgentKeyPair } from './claim-service';
import { registerLien, releaseLien } from './lien-registry';

export class NegotiationService {
  /**
   * Validate that a state transition is permitted by the explicit protocol FSM.
   */
  static validateTransition(from: NegotiationState, to: NegotiationState): boolean {
    const allowed = VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * Create a new negotiation session backed by Prisma.
   */
  static async createNegotiation(params: {
    invoiceNumber: string;
    amount: number;
    currency: string;
    supplierOrgId: string;
    supplierOrgName: string;
    buyerOrgId: string;
    buyerOrgName: string;
    dueDate?: string;
  }) {
    const correlationId = uuidv4();

    // Register active lien on receivable to enforce TransCare fraud prevention
    await registerLien({
      invoiceNumber: params.invoiceNumber,
      creditorOrgId: params.supplierOrgId,
      creditorOrgName: params.supplierOrgName,
      negotiationId: '',
    });

    const negotiation = await prisma.negotiation.create({
      data: {
        invoiceId: params.invoiceNumber,
        supplierOrgId: params.supplierOrgId,
        buyerOrgId: params.buyerOrgId,
        state: 'EVIDENCE_REQUESTED',
        correlationId,
      },
    });

    // Update lien with real negotiationId
    await prisma.receivableLien.updateMany({
      where: { invoiceNumber: params.invoiceNumber, status: 'ACTIVE' },
      data: { negotiationId: negotiation.id },
    });

    // Generate supplier agent keypair and sign initial invoice claim
    const supplierAgent = generateAgentKeyPair(
      `agent-${params.supplierOrgId}`,
      'Settlement Agent',
      params.supplierOrgId,
      params.supplierOrgName
    );

    const issueDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dueDate = params.dueDate || new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const claim = createSignedClaim(
      'INVOICE_RECORDED',
      {
        type: 'INVOICE_RECORDED',
        invoiceNumber: params.invoiceNumber,
        supplierOrg: params.supplierOrgName,
        buyerOrg: params.buyerOrgName,
        amount: params.amount,
        currency: params.currency,
        issueDate,
        dueDate,
        daysOverdue: 22,
        ledgerBasis: 'SUPPLIER_ACCOUNTS_RECEIVABLE',
      },
      supplierAgent,
      {
        subject: params.invoiceNumber,
        sourceSystem: 'ZWAPGRID',
        correlationId,
      }
    );

    await prisma.claim.create({
      data: {
        claimType: claim.claimType,
        issuerAgentId: supplierAgent.agentId,
        issuerOrganization: params.supplierOrgName,
        subject: params.invoiceNumber,
        payload: JSON.stringify(claim.payload),
        sourceSystem: 'ZWAPGRID',
        evidenceHash: claim.evidenceHash,
        correlationId,
        signature: claim.signature,
        verificationStatus: 'VERIFIED',
        negotiationId: negotiation.id,
      },
    });

    // Advance to SUPPLIER_EVIDENCE_PRESENTED
    const updatedNegotiation = await prisma.negotiation.update({
      where: { id: negotiation.id },
      data: { state: 'SUPPLIER_EVIDENCE_PRESENTED' },
    });

    await prisma.auditEvent.create({
      data: {
        negotiationId: negotiation.id,
        actor: params.supplierOrgName,
        actorType: 'SUPPLIER_AGENT',
        action: 'NEGOTIATION_CREATED',
        stateTransition: 'EVIDENCE_REQUESTED -> SUPPLIER_EVIDENCE_PRESENTED',
        correlationId,
        details: JSON.stringify({
          invoiceNumber: params.invoiceNumber,
          amount: params.amount,
          currency: params.currency,
        }),
      },
    });

    broadcastToNegotiation(
      negotiation.id,
      [params.supplierOrgId, params.buyerOrgId],
      'negotiation:created',
      params.supplierOrgId,
      {
        negotiationId: negotiation.id,
        invoiceNumber: params.invoiceNumber,
        amount: params.amount,
        currency: params.currency,
        state: 'SUPPLIER_EVIDENCE_PRESENTED',
      }
    );

    return updatedNegotiation;
  }

  /**
   * Transition negotiation state with audit logging.
   */
  static async transitionState(
    negotiationId: string,
    targetState: NegotiationState,
    actorName: string,
    actorType: 'SUPPLIER_AGENT' | 'BUYER_AGENT' | 'POLICY_ENGINE' | 'PAYMENT_CONTROLLER' | 'SYSTEM',
    details?: Record<string, unknown>
  ) {
    const negotiation = await prisma.negotiation.findUnique({
      where: { id: negotiationId },
    });

    if (!negotiation) {
      throw new Error(`Negotiation ${negotiationId} not found`);
    }

    const currentState = negotiation.state as NegotiationState;
    if (!this.validateTransition(currentState, targetState)) {
      throw new Error(`Invalid transition from ${currentState} to ${targetState}`);
    }

    const isTerminal = ['COMPLETED', 'REJECTED', 'ESCALATED'].includes(targetState);

    const updated = await prisma.negotiation.update({
      where: { id: negotiationId },
      data: {
        state: targetState,
        completedAt: isTerminal ? new Date() : undefined,
      },
    });

    await prisma.auditEvent.create({
      data: {
        negotiationId,
        actor: actorName,
        actorType,
        action: `STATE_CHANGE_TO_${targetState}`,
        stateTransition: `${currentState} -> ${targetState}`,
        correlationId: negotiation.correlationId,
        details: details ? JSON.stringify(details) : null,
      },
    });

    // If completed or rejected, release any active liens
    if (isTerminal) {
      await releaseLien(negotiation.invoiceId, negotiation.supplierOrgId);
    }

    return updated;
  }
}
