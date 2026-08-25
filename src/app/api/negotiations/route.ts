/**
 * Negotiations API Route
 * 
 * POST /api/negotiations — Create a new settlement negotiation
 * GET  /api/negotiations — List negotiations for the logged-in org
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/db';
import { generateAgentKeyPair, createSignedClaim, verifyClaim } from '@/lib/services/claim-service';
import { broadcastToNegotiation } from '@/lib/services/event-bus';
import { registerLien } from '@/lib/services/lien-registry';

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

/**
 * POST /api/negotiations — Create a new settlement negotiation
 * Body: { buyerOrgCode: "AURORA", invoiceNumber: "INV-2026-1042", amount: 10000, currency: "EUR" }
 */
export async function POST(request: NextRequest) {
  try {
    const org = await getSessionOrg(request);
    if (!org) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { counterpartyCode, invoiceNumber, amount, currency = 'EUR', dueDate } = body;

    if (!counterpartyCode || !invoiceNumber || !amount) {
      return NextResponse.json(
        { success: false, error: 'counterpartyCode, invoiceNumber, and amount are required' },
        { status: 400 }
      );
    }

    // Find counterparty
    const counterparty = await prisma.organization.findUnique({
      where: { companyCode: counterpartyCode.toUpperCase() },
    });

    if (!counterparty) {
      return NextResponse.json(
        { success: false, error: `Unknown counterparty: ${counterpartyCode}` },
        { status: 404 }
      );
    }

    if (counterparty.id === org.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot negotiate with yourself' },
        { status: 400 }
      );
    }

    // The creator is the supplier (creditor) initiating settlement
    const supplierOrgId = org.id;
    const buyerOrgId = counterparty.id;
    const correlationId = uuidv4();

    // Register a lien on the receivable
    try {
      await registerLien({
        invoiceNumber,
        creditorOrgId: org.id,
        creditorOrgName: org.name,
        negotiationId: '', // Will update after creation
      });
    } catch (lienError) {
      // Double-financing detected
      return NextResponse.json(
        { success: false, error: (lienError as Error).message },
        { status: 409 }
      );
    }

    // Create negotiation in DB
    const negotiation = await prisma.negotiation.create({
      data: {
        invoiceId: invoiceNumber,
        supplierOrgId,
        buyerOrgId,
        state: 'EVIDENCE_REQUESTED',
        correlationId,
      },
    });

    // Generate agent keypairs for both parties
    const supplierAgent = generateAgentKeyPair(
      `agent-${org.id}`, 'Settlement Agent',
      org.id, org.name
    );

    // Create initial supplier claim
    const claim = createSignedClaim(
      'INVOICE_RECORDED',
      {
        type: 'INVOICE_RECORDED',
        invoiceNumber,
        supplierOrg: org.name,
        buyerOrg: counterparty.name,
        amount,
        currency,
        issueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dueDate: dueDate || new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        daysOverdue: 22,
        ledgerBasis: 'SUPPLIER_ACCOUNTS_RECEIVABLE',
      },
      supplierAgent,
      {
        subject: invoiceNumber,
        sourceSystem: 'ZWAPGRID',
        correlationId,
      }
    );

    // Store claim in DB
    await prisma.claim.create({
      data: {
        claimType: claim.claimType,
        issuerAgentId: supplierAgent.agentId,
        issuerOrganization: org.name,
        subject: invoiceNumber,
        payload: JSON.stringify(claim.payload),
        sourceSystem: 'ZWAPGRID',
        evidenceHash: claim.evidenceHash,
        correlationId,
        signature: claim.signature,
        verificationStatus: 'VERIFIED',
        negotiationId: negotiation.id,
      },
    });

    // Update negotiation state
    await prisma.negotiation.update({
      where: { id: negotiation.id },
      data: { state: 'SUPPLIER_EVIDENCE_PRESENTED' },
    });

    // Audit
    await prisma.auditEvent.create({
      data: {
        negotiationId: negotiation.id,
        actor: org.name,
        actorType: 'SUPPLIER_AGENT',
        action: 'NEGOTIATION_CREATED',
        correlationId,
        details: JSON.stringify({
          invoiceNumber,
          amount,
          currency,
          counterparty: counterparty.name,
        }),
      },
    });

    // Emit SSE events to both parties
    broadcastToNegotiation(
      negotiation.id,
      [supplierOrgId, buyerOrgId],
      'negotiation:created',
      supplierOrgId,
      {
        negotiationId: negotiation.id,
        invoiceNumber,
        amount,
        currency,
        supplierName: org.name,
        buyerName: counterparty.name,
        state: 'SUPPLIER_EVIDENCE_PRESENTED',
      }
    );

    return NextResponse.json({
      success: true,
      negotiation: {
        id: negotiation.id,
        invoiceNumber,
        amount,
        currency,
        supplierOrg: org.name,
        buyerOrg: counterparty.name,
        state: 'SUPPLIER_EVIDENCE_PRESENTED',
        correlationId,
        createdAt: negotiation.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Negotiations] Create error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/negotiations — List negotiations for the logged-in org
 */
export async function GET(request: NextRequest) {
  try {
    const org = await getSessionOrg(request);
    if (!org) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const negotiations = await prisma.negotiation.findMany({
      where: {
        OR: [
          { supplierOrgId: org.id },
          { buyerOrgId: org.id },
        ],
      },
      include: {
        claims: { orderBy: { issuedAt: 'asc' } },
        proposals: { orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { createdAt: 'asc' } },
        auditEvents: { orderBy: { timestamp: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Resolve org names
    const orgIds = [...new Set(negotiations.flatMap(n => [n.supplierOrgId, n.buyerOrgId]))];
    const orgs = await prisma.organization.findMany({
      where: { id: { in: orgIds } },
    });
    const orgMap = new Map(orgs.map(o => [o.id, o]));

    const result = negotiations.map(n => ({
      id: n.id,
      invoiceId: n.invoiceId,
      supplierOrg: orgMap.get(n.supplierOrgId)?.name ?? n.supplierOrgId,
      buyerOrg: orgMap.get(n.buyerOrgId)?.name ?? n.buyerOrgId,
      myRole: n.supplierOrgId === org.id ? 'SUPPLIER' : 'BUYER',
      state: n.state,
      currentRound: n.currentRound,
      correlationId: n.correlationId,
      claimCount: n.claims.length,
      proposalCount: n.proposals.length,
      paymentCount: n.payments.length,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
      completedAt: n.completedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({ success: true, negotiations: result });
  } catch (error) {
    console.error('[Negotiations] List error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
