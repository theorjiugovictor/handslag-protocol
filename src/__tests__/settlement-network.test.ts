import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateAgentKeyPair,
  createSignedClaim,
  verifyClaim,
  verifyAndUpdateClaim,
} from '@/lib/services/claim-service';
import {
  evaluateMandate,
  clearExecutedPayments,
} from '@/lib/services/mandate-policy-engine';
import {
  executePayment,
  clearPaymentData,
} from '@/lib/services/payment-controller';
import {
  runSuccessfulNegotiation,
  runRejectedProposal,
  resetDemo,
} from '@/lib/services/demo-scenario-service';
import { MockZwapgridAdapter } from '@/lib/adapters/mock-zwapgrid-adapter';
import { MockOpenPaymentsAdapter } from '@/lib/adapters/mock-open-payments-adapter';
import { TreasuryIntelligenceService } from '@/lib/services/treasury-intelligence';
import type { Mandate, MandateUsage } from '@/lib/types/mandate';

describe('Settlement Network Test Suite', () => {
  beforeEach(() => {
    resetDemo();
    clearExecutedPayments();
    clearPaymentData();
  });

  describe('1. Verifiable Claims & Ed25519 Signatures', () => {
    it('generates separate keypairs for supplier and buyer agents', () => {
      const supplierKey = generateAgentKeyPair('agent-1', 'SupplierAgent', 'org-1', 'Supplier AB');
      const buyerKey = generateAgentKeyPair('agent-2', 'BuyerAgent', 'org-2', 'Buyer AB');

      expect(supplierKey.publicKey).not.toEqual(buyerKey.publicKey);
      expect(supplierKey.privateKey).not.toEqual(buyerKey.privateKey);
      expect(supplierKey.publicKey).toHaveLength(64);
    });

    it('proves: A valid claim signature verifies', () => {
      const supplierKey = generateAgentKeyPair('agent-1', 'SupplierAgent', 'org-1', 'Supplier AB');
      const claim = createSignedClaim(
        'INVOICE_RECORDED',
        {
          type: 'INVOICE_RECORDED',
          invoiceNumber: 'INV-2026-1042',
          supplierOrg: 'Supplier AB',
          buyerOrg: 'Buyer AB',
          amount: 10000,
          currency: 'EUR',
          issueDate: '2026-07-15',
          dueDate: '2026-08-02',
          daysOverdue: 22,
          ledgerBasis: 'SUPPLIER_ACCOUNTS_RECEIVABLE',
        },
        supplierKey,
        {
          subject: 'INV-2026-1042',
          sourceSystem: 'ZWAPGRID',
          correlationId: 'corr-1',
        }
      );

      const isValid = verifyClaim(claim, supplierKey.publicKey);
      expect(isValid).toBe(true);

      const verifiedEnvelope = verifyAndUpdateClaim(claim, supplierKey.publicKey);
      expect(verifiedEnvelope.verificationStatus).toBe('VERIFIED');
    });

    it('proves: A tampered claim fails verification', () => {
      const supplierKey = generateAgentKeyPair('agent-1', 'SupplierAgent', 'org-1', 'Supplier AB');
      const claim = createSignedClaim(
        'INVOICE_RECORDED',
        {
          type: 'INVOICE_RECORDED',
          invoiceNumber: 'INV-2026-1042',
          supplierOrg: 'Supplier AB',
          buyerOrg: 'Buyer AB',
          amount: 10000,
          currency: 'EUR',
          issueDate: '2026-07-15',
          dueDate: '2026-08-02',
          daysOverdue: 22,
          ledgerBasis: 'SUPPLIER_ACCOUNTS_RECEIVABLE',
        },
        supplierKey,
        {
          subject: 'INV-2026-1042',
          sourceSystem: 'ZWAPGRID',
          correlationId: 'corr-1',
        }
      );

      // Tamper with payload (change amount from 10,000 to 15,000)
      const tamperedClaim = {
        ...claim,
        payload: {
          ...claim.payload,
          amount: 15000,
        },
      };

      const isValid = verifyClaim(tamperedClaim as any, supplierKey.publicKey);
      expect(isValid).toBe(false);

      const updated = verifyAndUpdateClaim(tamperedClaim as any, supplierKey.publicKey);
      expect(updated.verificationStatus).toBe('FAILED');
    });
  });

  describe('2. Obligation Matching & Trust Boundaries', () => {
    it('proves: Matching supplier and buyer records verifies the obligation', async () => {
      const supplierAdapter = new MockZwapgridAdapter('SUPPLIER');
      const buyerAdapter = new MockZwapgridAdapter('BUYER');

      const invoice = await supplierAdapter.getSupplierInvoice('INV-2026-1042');
      const payable = await buyerAdapter.getBuyerPayable('INV-2026-1042');

      expect(invoice).not.toBeNull();
      expect(payable).not.toBeNull();
      expect(invoice?.invoiceNumber).toBe(payable?.invoiceNumber);
      expect(invoice?.amount).toBe(payable?.amount);
      expect(invoice?.currency).toBe(payable?.currency);
      expect(invoice?.dueDate).toBe(payable?.dueDate);
      expect(payable?.hasDisputeFlag).toBe(false);
    });

    it('proves: Trust boundaries prevent cross-party ledger data access', async () => {
      const supplierAdapter = new MockZwapgridAdapter('SUPPLIER');
      const buyerAdapter = new MockZwapgridAdapter('BUYER');

      await expect(supplierAdapter.getBuyerPayable('INV-2026-1042')).rejects.toThrow(
        '[TRUST BOUNDARY]'
      );
      await expect(buyerAdapter.getSupplierInvoice('INV-2026-1042')).rejects.toThrow(
        '[TRUST BOUNDARY]'
      );
    });
  });

  describe('3. Deterministic Mandate Policy Engine', () => {
    const testMandate: Mandate = {
      mandateId: 'mandate-test-01',
      mandateVersion: 1,
      principal: {
        organizationId: 'org-buyer-001',
        organizationName: 'Aurora Retail AB',
      },
      authorizedAgentId: 'agent-buyer-001',
      sourceAccount: 'SE1230000000000000000001',
      approvedCounterpartyIds: ['org-supplier-001'],
      approvedDestination: 'SE1230000000000000000002',
      allowedCurrencies: ['EUR'],
      maxAmountPerPayment: 6000,
      maxCumulativeAmount: 12000,
      maxDailyAmount: 8000,
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
        signedFields: ['mandateId'],
        signatureValue: 'sig-test',
      },
    };

    const emptyUsage: MandateUsage = {
      mandateId: 'mandate-test-01',
      totalSpent: 0,
      dailySpent: 0,
      dailyDate: '2026-08-24',
      paymentCount: 0,
    };

    it('proves: The default EUR 4,000 payment passes the mandate', () => {
      const evaluation = evaluateMandate({
        mandate: testMandate,
        paymentAmount: 4000,
        currency: 'EUR',
        destinationAccount: 'SE1230000000000000000002',
        counterpartyId: 'org-supplier-001',
        executionDate: '2026-08-24',
        idempotencyKey: 'idemp-test-4000',
        isFutureDated: false,
        usage: emptyUsage,
      });

      expect(evaluation.overallResult).toBe('PASS');
      expect(evaluation.failureReasons).toHaveLength(0);
      expect(evaluation.checks.every(c => c.result === 'PASS')).toBe(true);
    });

    it('proves: An over-limit payment is rejected', () => {
      const evaluation = evaluateMandate({
        mandate: testMandate,
        paymentAmount: 8000, // exceeds maxAmountPerPayment of 6000
        currency: 'EUR',
        destinationAccount: 'SE1230000000000000000002',
        counterpartyId: 'org-supplier-001',
        executionDate: '2026-08-24',
        idempotencyKey: 'idemp-test-8000',
        isFutureDated: false,
        usage: emptyUsage,
      });

      expect(evaluation.overallResult).toBe('FAIL');
      expect(evaluation.failureReasons.some(r => r.includes('ceiling'))).toBe(true);
    });

    it('proves: An unapproved counterparty is rejected', () => {
      const evaluation = evaluateMandate({
        mandate: testMandate,
        paymentAmount: 4000,
        currency: 'EUR',
        destinationAccount: 'SE1230000000000000000002',
        counterpartyId: 'org-fraudulent-counterparty',
        executionDate: '2026-08-24',
        idempotencyKey: 'idemp-test-counterparty',
        isFutureDated: false,
        usage: emptyUsage,
      });

      expect(evaluation.overallResult).toBe('FAIL');
      expect(evaluation.failureReasons.some(r => r.includes('not approved'))).toBe(true);
    });

    it('proves: An expired or revoked mandate is rejected', () => {
      const revokedMandate = { ...testMandate, revoked: true };
      const evalRevoked = evaluateMandate({
        mandate: revokedMandate,
        paymentAmount: 4000,
        currency: 'EUR',
        destinationAccount: 'SE1230000000000000000002',
        counterpartyId: 'org-supplier-001',
        executionDate: '2026-08-24',
        idempotencyKey: 'idemp-revoked',
        isFutureDated: false,
        usage: emptyUsage,
      });
      expect(evalRevoked.overallResult).toBe('FAIL');
      expect(evalRevoked.failureReasons.some(r => r.includes('revoked'))).toBe(true);

      const expiredMandate = { ...testMandate, expiresAt: '2020-01-01T00:00:00Z' };
      const evalExpired = evaluateMandate({
        mandate: expiredMandate,
        paymentAmount: 4000,
        currency: 'EUR',
        destinationAccount: 'SE1230000000000000000002',
        counterpartyId: 'org-supplier-001',
        executionDate: '2026-08-24',
        idempotencyKey: 'idemp-expired',
        isFutureDated: false,
        usage: emptyUsage,
      });
      expect(evalExpired.overallResult).toBe('FAIL');
      expect(evalExpired.failureReasons.some(r => r.includes('expired'))).toBe(true);
    });

    it('proves: A changed destination account is rejected', () => {
      const evaluation = evaluateMandate({
        mandate: testMandate,
        paymentAmount: 4000,
        currency: 'EUR',
        destinationAccount: 'SE9999999999999999999999', // Unknown destination
        counterpartyId: 'org-supplier-001',
        executionDate: '2026-08-24',
        idempotencyKey: 'idemp-changed-dest',
        isFutureDated: false,
        usage: emptyUsage,
      });

      expect(evaluation.overallResult).toBe('FAIL');
      expect(evaluation.failureReasons.some(r => r.includes('Destination account'))).toBe(true);
    });
  });

  describe('4. Payment Controller & Idempotency', () => {
    const testMandate: Mandate = {
      mandateId: 'mandate-test-01',
      mandateVersion: 1,
      principal: { organizationId: 'org-buyer-001', organizationName: 'Aurora Retail AB' },
      authorizedAgentId: 'agent-buyer-001',
      sourceAccount: 'SE1230000000000000000001',
      approvedCounterpartyIds: ['org-supplier-001'],
      approvedDestination: 'SE1230000000000000000002',
      allowedCurrencies: ['EUR'],
      maxAmountPerPayment: 6000,
      maxCumulativeAmount: 12000,
      maxDailyAmount: 8000,
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
        signedFields: ['mandateId'],
        signatureValue: 'sig-test',
      },
    };

    const emptyUsage: MandateUsage = {
      mandateId: 'mandate-test-01',
      totalSpent: 0,
      dailySpent: 0,
      dailyDate: '2026-08-24',
      paymentCount: 0,
    };

    it('proves: Duplicate payment instructions are not executed twice', async () => {
      const adapter = new MockOpenPaymentsAdapter();
      const params = {
        negotiationId: 'neg-idemp-01',
        mandate: testMandate,
        mandateUsage: emptyUsage,
        amount: 4000,
        currency: 'EUR',
        debtorAccount: 'SE1230000000000000000001',
        creditorAccount: 'SE1230000000000000000002',
        creditorName: 'Nordic Components AB',
        counterpartyId: 'org-supplier-001',
        executionDate: '2026-08-24',
        isFutureDated: false,
        remittanceInfo: 'Settlement test',
        correlationId: 'corr-idemp',
        openPaymentsAdapter: adapter,
      };

      const firstCall = await executePayment(params);
      expect(firstCall.instruction.status).toBe('AUTHORIZATION_REQUIRED');
      expect(firstCall.apiResponse).not.toBeNull();

      const secondCall = await executePayment(params);
      // Returns same instruction and apiResponse is null (blocked from re-initiation)
      expect(secondCall.instruction.id).toBe(firstCall.instruction.id);
      expect(secondCall.apiResponse).toBeNull();
    });

    it('proves: Workflow cannot execute payment before policy approval', async () => {
      const adapter = new MockOpenPaymentsAdapter();
      const params = {
        negotiationId: 'neg-reject-01',
        mandate: testMandate,
        mandateUsage: emptyUsage,
        amount: 9500, // Violates per-payment ceiling
        currency: 'EUR',
        debtorAccount: 'SE1230000000000000000001',
        creditorAccount: 'SE1230000000000000000002',
        creditorName: 'Nordic Components AB',
        counterpartyId: 'org-supplier-001',
        executionDate: '2026-08-24',
        isFutureDated: false,
        remittanceInfo: 'Out of policy attempt',
        correlationId: 'corr-reject',
        openPaymentsAdapter: adapter,
      };

      const result = await executePayment(params);
      expect(result.policyEvaluation.overallResult).toBe('FAIL');
      expect(result.instruction.status).toBe('FAILED');
      expect(result.apiResponse).toBeNull();
    });

    it('proves: Verification of Payee (VoP) pre-flight mismatch prevents payment initiation', async () => {
      const adapter = new MockOpenPaymentsAdapter();
      const params = {
        negotiationId: 'neg-vop-01',
        mandate: testMandate,
        mandateUsage: emptyUsage,
        amount: 4000,
        currency: 'EUR',
        debtorAccount: 'SE1230000000000000000001',
        creditorAccount: 'SE1230000000000000000002',
        creditorName: 'Unknown Fraudulent Entity', // Fails VoP check
        counterpartyId: 'org-supplier-001',
        executionDate: '2026-08-24',
        isFutureDated: false,
        remittanceInfo: 'VoP test',
        correlationId: 'corr-vop',
        openPaymentsAdapter: adapter,
      };

      const result = await executePayment(params);
      expect(result.instruction.status).toBe('FAILED');
      expect(result.apiResponse).toBeNull();
    });

    it('proves: Direct bypass attempt with revoked mandate is blocked', async () => {
      const adapter = new MockOpenPaymentsAdapter();
      const revoked = { ...testMandate, revoked: true };
      const params = {
        negotiationId: 'neg-direct-01',
        mandate: revoked,
        mandateUsage: emptyUsage,
        amount: 4000,
        currency: 'EUR',
        debtorAccount: 'SE1230000000000000000001',
        creditorAccount: 'SE1230000000000000000002',
        creditorName: 'Nordic Components AB',
        counterpartyId: 'org-supplier-001',
        executionDate: '2026-08-24',
        isFutureDated: false,
        remittanceInfo: 'Direct call test',
        correlationId: 'corr-direct',
        openPaymentsAdapter: adapter,
      };

      const result = await executePayment(params);
      expect(result.policyEvaluation.overallResult).toBe('FAIL');
      expect(result.instruction.status).toBe('FAILED');
      expect(result.apiResponse).toBeNull();
    });
  });

  describe('5. End-to-End Autonomous Negotiation Scenarios', () => {
    it('proves: The critical successful demo works end-to-end (EUR 4,000 now + EUR 6,000 scheduled)', async () => {
      const state = await runSuccessfulNegotiation();

      expect(state.isComplete).toBe(true);
      expect(state.state).toBe('COMPLETED');
      expect(state.scenario).toBe('SUCCESS');
      expect(state.timeline.length).toBeGreaterThanOrEqual(10);
      expect(state.payments).toHaveLength(2);

      // Payment 1: €4,000 immediate
      const immediate = state.payments[0];
      expect(immediate.amount).toBe(4000);
      expect(immediate.isFutureDated).toBe(false);
      expect(immediate.status).toBe('AUTHORIZATION_REQUIRED');

      // Payment 2: €6,000 scheduled
      const scheduled = state.payments[1];
      expect(scheduled.amount).toBe(6000);
      expect(scheduled.isFutureDated).toBe(true);
      expect(scheduled.status).toBe('AUTHORIZATION_REQUIRED');

      // Audit log has complete trail
      expect(state.auditLog.length).toBeGreaterThan(5);
    });

    it('proves: Out-of-policy proposal rejection scenario works end-to-end and highlights both violations', async () => {
      const state = await runRejectedProposal();

      expect(state.isComplete).toBe(true);
      expect(state.state).toBe('REJECTED');
      expect(state.scenario).toBe('REJECTION');
      expect(state.payments).toHaveLength(0); // No payments executed

      // Check rejection timeline event mentions both rules
      const rejectionEvent = state.timeline.find(t => t.claimType === 'PAYMENT_REJECTED');
      expect(rejectionEvent).toBeDefined();
      expect(rejectionEvent?.actor).toBe('POLICY_ENGINE');
      expect(rejectionEvent?.summary).toContain('6,000');
      expect(rejectionEvent?.summary).toContain('4,000');
    });

    it('proves: Buyer raw bank balance is strictly isolated from shared claims', async () => {
      const state = await runSuccessfulNegotiation();
      // Inspect all claim payloads to verify raw bank balance (€24,000) is never leaked
      const stringifiedClaims = JSON.stringify(state.claims);
      expect(stringifiedClaims).not.toContain('24000');
      expect(stringifiedClaims).not.toContain('24,000');
    });

    it('proves: Treasury BI calculates safe liquidity capacity and 30-day cash curve', () => {
      const treasury = TreasuryIntelligenceService.getBuyerTreasuryState(24000, 20000, 10000);

      expect(treasury.consolidatedCashBalance).toBe(24000);
      expect(treasury.operationalReserve).toBe(20000);
      expect(treasury.safePaymentCapacityToday).toBe(4000);
      expect(treasury.accounts).toHaveLength(2);
      expect(treasury.dailyProjections.length).toBe(31);

      // Check payroll drop at day 25
      const day25 = treasury.dailyProjections.find((p: any) => p.dayOffset === 25);
      expect(day25).toBeDefined();
      expect(day25?.scheduledOutflows).toBe(18000);
      expect(day25?.projectedBalance).toBeGreaterThan(0); // Safe runway
    });

    it('proves: PSD2 Data Triangulation enriches raw bank defects with Zwapgrid ERP ledger', () => {
      const treasury = TreasuryIntelligenceService.getBuyerTreasuryState(24000, 20000, 10000);

      expect(treasury.triangulatedFeed.length).toBeGreaterThan(0);
      const sample = treasury.triangulatedFeed[0];
      expect(sample.rawBankEntry.rawCounterpartyName).toBeNull(); // Missing in raw PSD2
      expect(sample.erpEnrichment.verifiedCounterpartyName).toBe('Nordic Components AB'); // Enriched via Zwapgrid
      expect(sample.erpEnrichment.reconciliationConfidence).toBeGreaterThan(0.95);
      expect(treasury.psd2DataQualityReport.triangulatedCompletenessAvg).toBe(100.0);
    });
  });
});
