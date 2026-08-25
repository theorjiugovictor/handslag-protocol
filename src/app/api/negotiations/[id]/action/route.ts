/**
 * Negotiation Action API Route
 * 
 * POST /api/negotiations/[id]/action — Perform a negotiation action
 * GET  /api/negotiations/[id] — Get full negotiation state
 * 
 * Actions: MATCH_PAYABLE, PROPOSE, COUNTER, ACCEPT, REJECT
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/db';
import { generateAgentKeyPair, createSignedClaim } from '@/lib/services/claim-service';
import { evaluateMandate } from '@/lib/services/mandate-policy-engine';
import { broadcastToNegotiation } from '@/lib/services/event-bus';
import type { NegotiationState } from '@/lib/types/negotiation';
import { VALID_TRANSITIONS } from '@/lib/types/negotiation';

async function getSessionOrg(request: NextRequest) {
  const sessionToken = request.cookies.get('session_token')?.value;
  if (!sessionToken) return null;
  
  const session = await prisma.session.findUnique({
    where: { sessionToken },
    include: { organization: true },
  });
  
  if (!session || !session.isActive) return null;
  return session.organization;
}

function assertTransition(from: string, to: string) {
  const valid = VALID_TRANSITIONS[from as NegotiationState];
  if (!valid || !valid.includes(to as NegotiationState)) {
    throw new Error(`Invalid state transition: ${from} -> ${to}`);
  }
}

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/negotiations/[id] — Get full negotiation state
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const org = await getSessionOrg(request);
    if (!org) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    
    const negotiation = await prisma.negotiation.findUnique({
      where: { id },
      include: {
        claims: { orderBy: { issuedAt: 'asc' } },
        proposals: { orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { createdAt: 'asc' } },
        policyEvals: { orderBy: { evaluatedAt: 'asc' } },
        auditEvents: { orderBy: { timestamp: 'asc' } },
      },
    });

    if (!negotiation) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    // Verify caller is a party
    if (negotiation.supplierOrgId !== org.id && negotiation.buyerOrgId !== org.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Resolve org names
    const [supplier, buyer] = await Promise.all([
      prisma.organization.findUnique({ where: { id: negotiation.supplierOrgId } }),
      prisma.organization.findUnique({ where: { id: negotiation.buyerOrgId } }),
    ]);

    return NextResponse.json({
      success: true,
      negotiation: {
        id: negotiation.id,
        invoiceId: negotiation.invoiceId,
        supplierOrg: { id: supplier?.id, name: supplier?.name, orgNumber: supplier?.orgNumber },
        buyerOrg: { id: buyer?.id, name: buyer?.name, orgNumber: buyer?.orgNumber },
        myRole: negotiation.supplierOrgId === org.id ? 'SUPPLIER' : 'BUYER',
        state: negotiation.state,
        currentRound: negotiation.currentRound,
        correlationId: negotiation.correlationId,
        claims: negotiation.claims.map(c => ({
          id: c.id,
          claimType: c.claimType,
          issuerOrganization: c.issuerOrganization,
          subject: c.subject,
          payload: JSON.parse(c.payload),
          sourceSystem: c.sourceSystem,
          evidenceHash: c.evidenceHash,
          verificationStatus: c.verificationStatus,
          issuedAt: c.issuedAt.toISOString(),
          signature: c.signature,
        })),
        proposals: negotiation.proposals.map(p => ({
          id: p.id,
          proposerRole: p.proposerRole,
          installments: JSON.parse(p.installments),
          totalAmount: p.totalAmount,
          currency: p.currency,
          rationaleCode: p.rationaleCode,
          status: p.status,
          sequenceNumber: p.sequenceNumber,
          createdAt: p.createdAt.toISOString(),
        })),
        payments: negotiation.payments.map(p => ({
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          executionDate: p.executionDate.toISOString(),
          isFutureDated: p.isFutureDated,
          status: p.status,
          externalPaymentId: p.externalPaymentId,
          isMocked: p.isMocked,
        })),
        auditLog: negotiation.auditEvents.map(e => ({
          id: e.id,
          actor: e.actor,
          actorType: e.actorType,
          action: e.action,
          policyDecision: e.policyDecision,
          stateTransition: e.stateTransition,
          timestamp: e.timestamp.toISOString(),
        })),
        createdAt: negotiation.createdAt.toISOString(),
        updatedAt: negotiation.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Negotiation] Get error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/negotiations/[id]/action — Perform negotiation action
 * Body: { type: "MATCH_PAYABLE" | "PROPOSE" | "COUNTER" | "ACCEPT" | "REJECT", payload: {...} }
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const org = await getSessionOrg(request);
    if (!org) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { type: actionType, payload: actionPayload } = body;

    const negotiation = await prisma.negotiation.findUnique({
      where: { id },
      include: { claims: true, proposals: true },
    });

    if (!negotiation) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    // Verify caller is a party
    const myRole = negotiation.supplierOrgId === org.id ? 'SUPPLIER' : 'BUYER';
    if (negotiation.supplierOrgId !== org.id && negotiation.buyerOrgId !== org.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const counterpartyId = myRole === 'SUPPLIER' ? negotiation.buyerOrgId : negotiation.supplierOrgId;
    const counterparty = await prisma.organization.findUnique({ where: { id: counterpartyId } });
    const agent = generateAgentKeyPair(`agent-${org.id}`, 'Settlement Agent', org.id, org.name);

    switch (actionType) {
      case 'MATCH_PAYABLE': {
        // Buyer confirms the payable matches
        if (myRole !== 'BUYER') {
          return NextResponse.json({ success: false, error: 'Only buyer can match payable' }, { status: 403 });
        }
        
        assertTransition(negotiation.state, 'BUYER_MATCH_PENDING');

        const claim = createSignedClaim(
          'PAYABLE_MATCHED',
          {
            type: 'PAYABLE_MATCHED',
            invoiceNumber: negotiation.invoiceId,
            supplierOrg: counterparty?.name ?? '',
            buyerOrg: org.name,
            matchedAmount: actionPayload?.amount ?? 10000,
            matchedCurrency: actionPayload?.currency ?? 'EUR',
            matchedDueDate: actionPayload?.dueDate ?? new Date().toISOString().split('T')[0],
            matchResult: 'FULL_MATCH',
            verificationBasis: 'BUYER_ACCOUNTS_PAYABLE',
            hasDisputeFlag: false,
          },
          agent,
          { subject: negotiation.invoiceId, sourceSystem: 'ZWAPGRID', correlationId: negotiation.correlationId }
        );

        await prisma.claim.create({
          data: {
            claimType: 'PAYABLE_MATCHED',
            issuerAgentId: agent.agentId,
            issuerOrganization: org.name,
            subject: negotiation.invoiceId,
            payload: JSON.stringify(claim.payload),
            sourceSystem: 'ZWAPGRID',
            evidenceHash: claim.evidenceHash,
            correlationId: negotiation.correlationId,
            signature: claim.signature,
            verificationStatus: 'VERIFIED',
            negotiationId: negotiation.id,
          },
        });

        // Auto-advance through BUYER_MATCH_PENDING → OBLIGATION_VERIFIED
        await prisma.negotiation.update({
          where: { id: negotiation.id },
          data: { state: 'OBLIGATION_VERIFIED' },
        });

        await prisma.auditEvent.create({
          data: {
            negotiationId: negotiation.id,
            actor: org.name,
            actorType: 'BUYER_AGENT',
            action: 'PAYABLE_MATCHED_AND_OBLIGATION_VERIFIED',
            correlationId: negotiation.correlationId,
          },
        });

        broadcastToNegotiation(
          negotiation.id,
          [negotiation.supplierOrgId, negotiation.buyerOrgId],
          'negotiation:updated',
          org.id,
          { state: 'OBLIGATION_VERIFIED', action: 'MATCH_PAYABLE', actor: org.name }
        );

        return NextResponse.json({ success: true, state: 'OBLIGATION_VERIFIED' });
      }

      case 'PROPOSE':
      case 'COUNTER': {
        const installments = actionPayload?.installments;
        if (!installments || !Array.isArray(installments) || installments.length === 0) {
          return NextResponse.json({ success: false, error: 'installments array required' }, { status: 400 });
        }

        const totalAmount = installments.reduce((sum: number, i: { amount: number }) => sum + i.amount, 0);
        const targetState = actionType === 'PROPOSE' ? 'INITIAL_PROPOSAL' : 'COUNTERPROPOSAL';
        
        assertTransition(negotiation.state, targetState);

        // Supersede previous proposals
        await prisma.proposal.updateMany({
          where: { negotiationId: negotiation.id, status: 'PENDING' },
          data: { status: 'SUPERSEDED' },
        });

        const proposal = await prisma.proposal.create({
          data: {
            negotiationId: negotiation.id,
            invoiceId: negotiation.invoiceId,
            proposerOrgId: org.id,
            proposerRole: myRole,
            installments: JSON.stringify(installments),
            totalAmount,
            currency: installments[0].currency || 'EUR',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            rationaleCode: actionType === 'PROPOSE' ? 'INITIAL' : 'LIQUIDITY_CONSTRAINED',
            supportingClaimIds: '[]',
            sequenceNumber: negotiation.proposals.length + 1,
            status: 'PENDING',
          },
        });

        const claim = createSignedClaim(
          'SETTLEMENT_PROPOSAL',
          {
            type: 'SETTLEMENT_PROPOSAL',
            proposalId: proposal.id,
            invoiceNumber: negotiation.invoiceId,
            installments,
            totalAmount,
            currency: installments[0].currency || 'EUR',
            rationale: actionPayload?.rationale ?? '',
          },
          agent,
          { subject: negotiation.invoiceId, sourceSystem: 'INTERNAL', correlationId: negotiation.correlationId }
        );

        await prisma.claim.create({
          data: {
            claimType: 'SETTLEMENT_PROPOSAL',
            issuerAgentId: agent.agentId,
            issuerOrganization: org.name,
            subject: negotiation.invoiceId,
            payload: JSON.stringify(claim.payload),
            sourceSystem: 'INTERNAL',
            evidenceHash: claim.evidenceHash,
            correlationId: negotiation.correlationId,
            signature: claim.signature,
            verificationStatus: 'VERIFIED',
            negotiationId: negotiation.id,
          },
        });

        await prisma.negotiation.update({
          where: { id: negotiation.id },
          data: { state: targetState, currentRound: { increment: 1 } },
        });

        await prisma.auditEvent.create({
          data: {
            negotiationId: negotiation.id,
            actor: org.name,
            actorType: myRole === 'SUPPLIER' ? 'SUPPLIER_AGENT' : 'BUYER_AGENT',
            action: actionType === 'PROPOSE' ? 'SETTLEMENT_PROPOSED' : 'COUNTERPROPOSAL_MADE',
            stateTransition: `${negotiation.state} -> ${targetState}`,
            correlationId: negotiation.correlationId,
            details: JSON.stringify({ totalAmount, installments }),
          },
        });

        broadcastToNegotiation(
          negotiation.id,
          [negotiation.supplierOrgId, negotiation.buyerOrgId],
          'proposal:received',
          org.id,
          {
            state: targetState,
            action: actionType,
            actor: org.name,
            proposal: { id: proposal.id, installments, totalAmount },
          }
        );

        return NextResponse.json({ success: true, state: targetState, proposalId: proposal.id });
      }

      case 'ACCEPT': {
        assertTransition(negotiation.state, 'AGREEMENT_REACHED');

        // Accept the latest pending proposal
        const latestProposal = negotiation.proposals
          .filter(p => p.status === 'PENDING')
          .sort((a, b) => b.sequenceNumber - a.sequenceNumber)[0];

        if (!latestProposal) {
          return NextResponse.json({ success: false, error: 'No pending proposal to accept' }, { status: 400 });
        }

        await prisma.proposal.update({
          where: { id: latestProposal.id },
          data: { status: 'ACCEPTED' },
        });

        await prisma.negotiation.update({
          where: { id: negotiation.id },
          data: { state: 'AGREEMENT_REACHED' },
        });

        await prisma.auditEvent.create({
          data: {
            negotiationId: negotiation.id,
            actor: org.name,
            actorType: myRole === 'SUPPLIER' ? 'SUPPLIER_AGENT' : 'BUYER_AGENT',
            action: 'SETTLEMENT_ACCEPTED',
            stateTransition: `${negotiation.state} -> AGREEMENT_REACHED`,
            correlationId: negotiation.correlationId,
          },
        });

        broadcastToNegotiation(
          negotiation.id,
          [negotiation.supplierOrgId, negotiation.buyerOrgId],
          'negotiation:updated',
          org.id,
          { state: 'AGREEMENT_REACHED', action: 'ACCEPT', actor: org.name }
        );

        return NextResponse.json({ success: true, state: 'AGREEMENT_REACHED' });
      }

      case 'REJECT': {
        assertTransition(negotiation.state, 'REJECTED');

        // Reject all pending proposals
        await prisma.proposal.updateMany({
          where: { negotiationId: negotiation.id, status: 'PENDING' },
          data: { status: 'REJECTED' },
        });

        await prisma.negotiation.update({
          where: { id: negotiation.id },
          data: { state: 'REJECTED', completedAt: new Date() },
        });

        await prisma.auditEvent.create({
          data: {
            negotiationId: negotiation.id,
            actor: org.name,
            actorType: myRole === 'SUPPLIER' ? 'SUPPLIER_AGENT' : 'BUYER_AGENT',
            action: 'NEGOTIATION_REJECTED',
            stateTransition: `${negotiation.state} -> REJECTED`,
            correlationId: negotiation.correlationId,
            details: JSON.stringify({ reason: actionPayload?.reason ?? 'Rejected by counterparty' }),
          },
        });

        broadcastToNegotiation(
          negotiation.id,
          [negotiation.supplierOrgId, negotiation.buyerOrgId],
          'negotiation:updated',
          org.id,
          { state: 'REJECTED', action: 'REJECT', actor: org.name }
        );

        return NextResponse.json({ success: true, state: 'REJECTED' });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${actionType}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Negotiation Action] Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Internal server error' },
      { status: 500 }
    );
  }
}
