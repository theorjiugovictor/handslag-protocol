import { describe, it, expect, beforeEach } from 'vitest';
import prisma from '@/lib/db';
import { NegotiationService } from '@/lib/services/negotiation-service';
import { evaluateMandate } from '@/lib/services/mandate-policy-engine';
import { registerLien } from '@/lib/services/lien-registry';
import type { Mandate, MandateUsage } from '@/lib/types/mandate';

describe('Handslag Protokoll Core Suite', () => {
  beforeEach(async () => {
    await prisma.auditEvent.deleteMany();
    await prisma.proposal.deleteMany();
    await prisma.claim.deleteMany();
    await prisma.receivableLien.deleteMany();
    await prisma.negotiation.deleteMany();
    await prisma.organization.deleteMany();

    await prisma.organization.createMany({
      data: [
        { id: 'org-nordic', name: 'Nordic Components AB', companyCode: 'NORDIC', orgNumber: '556789-0123', role: 'SUPPLIER' },
        { id: 'org-aurora', name: 'Aurora Retail AB', companyCode: 'AURORA', orgNumber: '559123-4568', role: 'BUYER' },
      ],
    });
  });

  it('1. Executes end-to-end autonomous bilateral settlement with multi-tranche cashflow', async () => {
    const negotiation = await NegotiationService.createNegotiation({
      invoiceNumber: 'INV-2026-AUTONOMOUS-01',
      amount: 10000,
      currency: 'EUR',
      supplierOrgId: 'org-nordic',
      supplierOrgName: 'Nordic Components AB',
      buyerOrgId: 'org-aurora',
      buyerOrgName: 'Aurora Retail AB',
      autoExecute: true,
    });

    expect(negotiation.state).toBe('COMPLETED');

    const proposals = await prisma.proposal.findMany({ where: { negotiationId: negotiation.id } });
    expect(proposals.length).toBe(1);
    expect(proposals[0].status).toBe('ACCEPTED');

    const installments = JSON.parse(proposals[0].installments);
    expect(installments.length).toBe(2);
    expect(installments[0].amount).toBe(4000);
    expect(installments[1].amount).toBe(6000);
  });

  it('2. Enforces TransCare double-financing lien prevention on receivables', async () => {
    await registerLien({
      invoiceNumber: 'INV-2026-DUPLICATE-CHECK',
      creditorOrgId: 'org-nordic',
      creditorOrgName: 'Nordic Components AB',
      negotiationId: 'neg-1',
    });

    // Attempt competing lien by a different creditor
    await expect(
      registerLien({
        invoiceNumber: 'INV-2026-DUPLICATE-CHECK',
        creditorOrgId: 'org-competitor',
        creditorOrgName: 'Shadow Factoring AB',
        negotiationId: 'neg-2',
      })
    ).rejects.toThrow(/DOUBLE_FINANCING_BLOCKED/);
  });

  it('3. Deterministically validates mandate policies (blocks overdrafts & unauthorized payees)', () => {
    const mockMandate: Mandate = {
      mandateId: 'm-1',
      mandateVersion: 1,
      principal: {
        organizationId: 'org-aurora',
        organizationName: 'Aurora Retail AB',
      },
      authorizedAgentId: 'agent-aurora',
      sourceAccount: 'SE8930000000001234567890',
      approvedCounterpartyIds: ['org-nordic'],
      approvedDestination: 'SE8930000000001234567890',
      allowedCurrencies: ['EUR', 'SEK'],
      maxAmountPerPayment: 5000,
      maxCumulativeAmount: 100000,
      maxDailyAmount: 20000,
      earliestExecDate: '2026-01-01',
      latestExecDate: '2026-12-31',
      futureDatedAllowed: true,
      effectiveAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-12-31T23:59:59Z',
      revoked: false,
      revokedAt: null,
      createdBy: 'CFO',
      signedAt: '2026-01-01T00:00:00Z',
      signatureMetadata: {
        type: 'DEMO_SIGNATURE',
        algorithm: 'Ed25519',
        signedBy: 'CFO',
        signedFields: [],
        signatureValue: 'sig-1',
      },
    };

    const emptyUsage: MandateUsage = {
      mandateId: 'm-1',
      totalSpent: 0,
      dailySpent: 0,
      dailyDate: '2026-08-25',
      paymentCount: 0,
    };

    const validEval = evaluateMandate({
      mandate: mockMandate,
      paymentAmount: 4000,
      currency: 'EUR',
      destinationAccount: 'SE8930000000001234567890',
      counterpartyId: 'org-nordic',
      executionDate: '2026-08-25',
      idempotencyKey: 'idem-1',
      isFutureDated: false,
      usage: emptyUsage,
    });

    expect(validEval.overallResult).toBe('PASS');

    const violatingEval = evaluateMandate({
      mandate: mockMandate,
      paymentAmount: 9000, // Exceeds maxAmountPerPayment of 5000
      currency: 'EUR',
      destinationAccount: 'SE8930000000001234567890',
      counterpartyId: 'org-nordic',
      executionDate: '2026-08-25',
      idempotencyKey: 'idem-2',
      isFutureDated: false,
      usage: emptyUsage,
    });

    expect(violatingEval.overallResult).toBe('FAIL');
  });
});
