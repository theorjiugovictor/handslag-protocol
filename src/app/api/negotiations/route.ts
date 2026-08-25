/**
 * Negotiations API Route
 * 
 * POST /api/negotiations — Create a new settlement negotiation
 * GET  /api/negotiations — List negotiations for the logged-in org
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { NegotiationService } from '@/lib/services/negotiation-service';

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
 */
export async function POST(request: NextRequest) {
  try {
    const org = await getSessionOrg(request);
    if (!org) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { counterpartyCode, invoiceNumber, amount, currency = 'EUR', dueDate, autoExecute = true } = body;

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

    try {
      const negotiation = await NegotiationService.createNegotiation({
        invoiceNumber,
        amount,
        currency,
        supplierOrgId: org.id,
        supplierOrgName: org.name,
        buyerOrgId: counterparty.id,
        buyerOrgName: counterparty.name,
        dueDate,
        autoExecute: autoExecute !== false,
      });

      return NextResponse.json({
        success: true,
        negotiation: {
          id: negotiation.id,
          invoiceNumber,
          amount,
          currency,
          supplierOrg: org.name,
          buyerOrg: counterparty.name,
          state: negotiation.state,
          correlationId: negotiation.correlationId,
          createdAt: negotiation.createdAt.toISOString(),
        },
      });
    } catch (lienError) {
      return NextResponse.json(
        { success: false, error: (lienError as Error).message },
        { status: 409 }
      );
    }
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

    const allOrgs = await prisma.organization.findMany();
    const orgMap = new Map(allOrgs.map(o => [o.id, o.name]));

    const negotiations = await prisma.negotiation.findMany({
      where: {
        OR: [
          { supplierOrgId: org.id },
          { buyerOrgId: org.id },
        ],
      },
      include: {
        claims: { select: { id: true } },
        proposals: { select: { id: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const summaries = negotiations.map(n => ({
      id: n.id,
      invoiceId: n.invoiceId,
      state: n.state,
      myRole: (n.supplierOrgId === org.id ? 'SUPPLIER' : 'BUYER') as 'SUPPLIER' | 'BUYER',
      supplierOrg: orgMap.get(n.supplierOrgId) || n.supplierOrgId,
      buyerOrg: orgMap.get(n.buyerOrgId) || n.buyerOrgId,
      claimCount: n.claims.length,
      proposalCount: n.proposals.length,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    }));

    return NextResponse.json({ success: true, negotiations: summaries });
  } catch (error) {
    console.error('[Negotiations] List error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
