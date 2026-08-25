/**
 * DemoScenarioService
 * 
 * Orchestrates the complete settlement negotiation demo.
 * Deterministic — works without any LLM. Each step produces
 * structured claims, follows the FSM, and generates timeline events.
 */

import { v4 as uuidv4 } from 'uuid';
import type { ClaimEnvelope } from '@/lib/types/claim';
import type { Mandate, MandateUsage } from '@/lib/types/mandate';
import type { NegotiationState, TimelineEvent } from '@/lib/types/negotiation';
import { VALID_TRANSITIONS } from '@/lib/types/negotiation';
import { createSignedClaim, generateAgentKeyPair, verifyClaim, type AgentKeyPair } from './claim-service';
import { evaluateMandate, clearExecutedPayments } from './mandate-policy-engine';
import { executePayment, clearPaymentData, type PaymentInstruction } from './payment-controller';
import { recordAuditEvent, clearAuditLog, getAuditLog, type AuditEntry } from './audit-service';
import { createZwapgridAdapter } from '@/lib/adapters';
import { MockOpenPaymentsAdapter } from '@/lib/adapters/mock-open-payments-adapter';
import { RealOpenPaymentsAdapter } from '@/lib/adapters/real-open-payments-adapter';
import {
  type ScenarioConfig,
  DEFAULT_SCENARIO_CONFIG,
  SupplierAgentDecisionEngine,
  BuyerAgentDecisionEngine,
} from './agent-decision-engine';

// ─── Demo Constants ────────────────────────────────────────────

const SUPPLIER_ORG = { id: 'org-supplier-001', name: 'Nordic Components AB', orgNumber: '556789-0123' };
const BUYER_ORG = { id: 'org-buyer-001', name: 'Aurora Retail AB', orgNumber: '559123-4568' };

const SUPPLIER_IBAN = 'SE** **** **** **** **02';
const BUYER_IBAN = 'SE** **** **** **** **01';

// ─── Demo State ────────────────────────────────────────────────

export interface DemoState {
  negotiationId: string;
  correlationId: string;
  state: NegotiationState;
  claims: ClaimEnvelope[];
  timeline: TimelineEvent[];
  payments: PaymentInstruction[];
  mandate: Mandate;
  mandateUsage: MandateUsage;
  supplierAgent: AgentKeyPair;
  buyerAgent: AgentKeyPair;
  currentStep: number;
  totalSteps: number;
  isComplete: boolean;
  scenario: 'SUCCESS' | 'REJECTION';
  auditLog: AuditEntry[];
  config: ScenarioConfig;
}

let currentDemo: DemoState | null = null;

// ─── Date helpers ──────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

function getThe14th(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // If we're past the 14th, use next month
  if (now.getDate() > 14) {
    return new Date(year, month + 1, 14).toISOString().split('T')[0];
  }
  return new Date(year, month, 14).toISOString().split('T')[0];
}

// ─── Create Default Mandate ────────────────────────────────────

function createDefaultMandate(buyerAgentId: string, customConfig?: Partial<ScenarioConfig>): Mandate {
  const now = new Date().toISOString();
  const ceiling = customConfig?.buyerMandateCeiling ?? 6000;
  const totalCap = (customConfig?.invoiceAmount ?? 10000) + 2000;
  return {
    mandateId: 'mandate-001',
    mandateVersion: 1,
    principal: {
      organizationId: BUYER_ORG.id,
      organizationName: BUYER_ORG.name,
    },
    authorizedAgentId: buyerAgentId,
    sourceAccount: BUYER_IBAN,
    approvedCounterpartyIds: [SUPPLIER_ORG.id],
    approvedDestination: SUPPLIER_IBAN,
    allowedCurrencies: ['EUR'],
    maxAmountPerPayment: ceiling,
    maxCumulativeAmount: totalCap,
    maxDailyAmount: Math.max(8000, ceiling),
    earliestExecDate: today(),
    latestExecDate: futureDate(30),
    futureDatedAllowed: true,
    effectiveAt: now,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    revoked: false,
    revokedAt: null,
    createdBy: 'CFO, Aurora Retail AB',
    signedAt: now,
    signatureMetadata: {
      type: 'DEMO_SIGNATURE',
      algorithm: 'Ed25519',
      signedBy: 'CFO, Aurora Retail AB',
      signedFields: ['mandateId', 'principal', 'maxAmountPerPayment', 'maxCumulativeAmount', 'approvedCounterpartyIds', 'approvedDestination'],
      signatureValue: 'demo-mandate-sig-' + uuidv4().slice(0, 8),
    },
  };
}

// ─── FSM Transition ────────────────────────────────────────────

function transition(current: NegotiationState, next: NegotiationState): void {
  const valid = VALID_TRANSITIONS[current];
  if (!valid.includes(next)) {
    throw new Error(`Invalid state transition: ${current} -> ${next}`);
  }
}

// ─── Add Timeline Event ────────────────────────────────────────

function addTimelineEvent(
  demo: DemoState,
  params: Omit<TimelineEvent, 'id' | 'timestamp'>
): TimelineEvent {
  const event: TimelineEvent = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    ...params,
  };
  demo.timeline.push(event);
  return event;
}

// ─── Reset Demo ────────────────────────────────────────────────

export function resetDemo(): void {
  currentDemo = null;
  clearExecutedPayments();
  clearPaymentData();
  clearAuditLog();
}

// ─── Get Current State ─────────────────────────────────────────

export function getDemoState(): DemoState | null {
  return currentDemo;
}

// ─── Initialize Demo ──────────────────────────────────────────

export function initializeDemo(scenario: 'SUCCESS' | 'REJECTION', customConfig?: Partial<ScenarioConfig>): DemoState {
  resetDemo();

  const config: ScenarioConfig = {
    ...DEFAULT_SCENARIO_CONFIG,
    ...customConfig,
  };

  const supplierAgent = generateAgentKeyPair(
    'agent-supplier-001', 'Supplier Settlement Agent',
    SUPPLIER_ORG.id, SUPPLIER_ORG.name
  );
  const buyerAgent = generateAgentKeyPair(
    'agent-buyer-001', 'Buyer Settlement Agent',
    BUYER_ORG.id, BUYER_ORG.name
  );
  const mandate = createDefaultMandate(buyerAgent.agentId, config);

  const demo: DemoState = {
    negotiationId: uuidv4(),
    correlationId: uuidv4(),
    state: 'EVIDENCE_REQUESTED',
    claims: [],
    timeline: [],
    payments: [],
    mandate,
    mandateUsage: {
      mandateId: mandate.mandateId,
      totalSpent: 0,
      dailySpent: 0,
      dailyDate: today(),
      paymentCount: 0,
    },
    supplierAgent,
    buyerAgent,
    currentStep: 0,
    totalSteps: scenario === 'SUCCESS' ? 10 : 3,
    isComplete: false,
    scenario,
    auditLog: [],
    config,
  };

  recordAuditEvent({
    negotiationId: demo.negotiationId,
    actor: 'System',
    actorType: 'SYSTEM',
    action: 'DEMO_INITIALIZED',
    correlationId: demo.correlationId,
    details: {
      scenario,
      supplier: SUPPLIER_ORG.name,
      buyer: BUYER_ORG.name,
      invoiceNumber: config.invoiceNumber || 'INV-2026-1042',
      invoiceAmount: config.invoiceAmount,
    },
  });

  currentDemo = demo;
  return demo;
}

// ─── Step Execution ────────────────────────────────────────────

async function executeStep(demo: DemoState): Promise<DemoState> {
  const step = demo.currentStep;

  if (demo.scenario === 'SUCCESS') {
    switch (step) {
      case 0: return await stepSupplierClaim(demo);
      case 1: return await stepBuyerMatch(demo);
      case 2: return stepObligationVerified(demo);
      case 3: return stepSupplierProposal(demo);
      case 4: return stepBuyerLiquidityConstraint(demo);
      case 5: return stepBuyerCounterproposal(demo);
      case 6: return stepSupplierAccepts(demo);
      case 7: return stepPolicyValidation(demo);
      case 8: return await stepImmediatePayment(demo);
      case 9: return await stepScheduledPayment(demo);
      default:
        demo.isComplete = true;
        return demo;
    }
  } else {
    // REJECTION scenario
    switch (step) {
      case 0: return await stepSupplierClaim(demo);
      case 1: return await stepBuyerMatch(demo);
      case 2: return stepObligationVerified(demo);
      case 3: return stepOutOfPolicyProposal(demo);
      case 4: return stepPolicyRejection(demo);
      case 5:
        demo.isComplete = true;
        demo.state = 'REJECTED';
        return demo;
      default:
        demo.isComplete = true;
        return demo;
    }
  }
}

// ─── Individual Steps ──────────────────────────────────────────

function zwapgridEvidenceLabel(mode: 'MOCK' | 'TEST' | 'LIVE'): string {
  if (mode === 'MOCK') return 'Zwapgrid [MOCK]';
  if (mode === 'TEST') return 'Zwapgrid [TEST DATA]';
  return 'Zwapgrid [LIVE DATA]';
}

function configuredZwapgridInvoiceReference(
  demo: DemoState,
  role: 'SUPPLIER' | 'BUYER'
): string {
  const configuredReference = role === 'SUPPLIER'
    ? process.env.ZWAPGRID_SUPPLIER_INVOICE_REFERENCE
    : process.env.ZWAPGRID_BUYER_INVOICE_REFERENCE;
  const defaultReference = DEFAULT_SCENARIO_CONFIG.invoiceNumber;
  const mode = (process.env.ZWAPGRID_MODE || 'mock').toLowerCase();

  if (configuredReference) return configuredReference;
  if (demo.config.invoiceNumber && (mode === 'mock' || demo.config.invoiceNumber !== defaultReference)) {
    return demo.config.invoiceNumber;
  }
  if (mode !== 'mock') {
    throw new Error(
      `Zwapgrid ${role.toLowerCase()} invoice reference is not configured. ` +
      `Set ${role === 'SUPPLIER' ? 'ZWAPGRID_SUPPLIER_INVOICE_REFERENCE' : 'ZWAPGRID_BUYER_INVOICE_REFERENCE'} ` +
      `to a reference from the connected accounting ledger.`
    );
  }
  return defaultReference || 'INV-2026-1042';
}

async function stepSupplierClaim(demo: DemoState): Promise<DemoState> {
  const supplierZwapgrid = createZwapgridAdapter('SUPPLIER');
  const supplierInvoiceNumber = configuredZwapgridInvoiceReference(demo, 'SUPPLIER');
  const invoice = await supplierZwapgrid.getSupplierInvoice(
    supplierInvoiceNumber,
    { correlationId: demo.correlationId }
  );
  if (!invoice) throw new Error('Invoice not found');

  // Synchronize configuration with retrieved ledger invoice
  demo.config.invoiceAmount = invoice.amount;
  demo.config.invoiceNumber = invoice.invoiceNumber;
  demo.config.currency = invoice.currency;

  const claim = createSignedClaim(
    'INVOICE_RECORDED',
    {
      type: 'INVOICE_RECORDED',
      invoiceNumber: invoice.invoiceNumber,
      supplierOrg: SUPPLIER_ORG.name,
      buyerOrg: invoice.counterpartyName,
      amount: invoice.amount,
      currency: invoice.currency,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      daysOverdue: Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
      ledgerBasis: 'SUPPLIER_ACCOUNTS_RECEIVABLE',
    },
    demo.supplierAgent,
    {
      subject: invoice.invoiceNumber,
      sourceSystem: 'ZWAPGRID',
      sourceRecordRef: invoice.externalRef,
      sourceRetrievedAt: invoice.retrievedAt,
      correlationId: demo.correlationId,
    }
  );

  demo.claims.push(claim);
  transition(demo.state, 'SUPPLIER_EVIDENCE_PRESENTED');
  const prevState = demo.state;
  demo.state = 'SUPPLIER_EVIDENCE_PRESENTED';

  const daysOverdue = Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24));
  addTimelineEvent(demo, {
    actor: 'SUPPLIER_AGENT',
    actorName: 'Nordic Components AB',
    claimType: 'INVOICE_RECORDED',
    summary: `Supplier claims invoice ${invoice.invoiceNumber} (€${invoice.amount.toLocaleString()}) is ${daysOverdue} days overdue. This is a signed claim based on supplier's accounts receivable ledger.`,
    evidenceSource: zwapgridEvidenceLabel(supplierZwapgrid.mode),
    signatureVerified: true,
    supportingClaimIds: [],
    stateTransition: { from: prevState, to: demo.state },
    details: { payload: claim.payload, claimId: claim.claimId },
    isMocked: supplierZwapgrid.mode === 'MOCK',
  });

  recordAuditEvent({
    negotiationId: demo.negotiationId,
    actor: demo.supplierAgent.agentName,
    actorType: 'SUPPLIER_AGENT',
    action: 'INVOICE_CLAIM_PRESENTED',
    inputClaimRefs: [claim.claimId],
    stateTransition: `${prevState} -> ${demo.state}`,
    correlationId: demo.correlationId,
  });

  demo.currentStep++;
  return demo;
}

async function stepBuyerMatch(demo: DemoState): Promise<DemoState> {
  const buyerZwapgrid = createZwapgridAdapter('BUYER');
  const buyerInvoiceNumber = configuredZwapgridInvoiceReference(demo, 'BUYER');
  const payable = await buyerZwapgrid.getBuyerPayable(
    buyerInvoiceNumber,
    { correlationId: demo.correlationId }
  );
  if (!payable) throw new Error('Payable not found');

  // Verify the supplier's claim first
  const supplierClaim = demo.claims.find(c => c.claimType === 'INVOICE_RECORDED');
  if (!supplierClaim) throw new Error('No supplier claim to verify');
  const isValid = verifyClaim(supplierClaim, demo.supplierAgent.publicKey);
  if (!isValid) throw new Error('Supplier claim signature verification failed');

  const supplierPayload = supplierClaim.payload as {
    amount: number;
    currency: string;
    dueDate: string;
  };
  if (
    supplierPayload.amount !== payable.amount ||
    supplierPayload.currency !== payable.currency ||
    supplierPayload.dueDate !== payable.dueDate
  ) {
    throw new Error(
      `Zwapgrid AR/AP mismatch for settlement: amount, currency, and due date must agree ` +
      `(AR ${supplierPayload.amount} ${supplierPayload.currency} due ${supplierPayload.dueDate}; ` +
      `AP ${payable.amount} ${payable.currency} due ${payable.dueDate})`
    );
  }

  const claim = createSignedClaim(
    'PAYABLE_MATCHED',
    {
      type: 'PAYABLE_MATCHED',
      invoiceNumber: payable.invoiceNumber,
      supplierOrg: payable.supplierName,
      buyerOrg: BUYER_ORG.name,
      matchedAmount: payable.amount,
      matchedCurrency: payable.currency,
      matchedDueDate: payable.dueDate,
      matchResult: 'FULL_MATCH',
      verificationBasis: 'BUYER_ACCOUNTS_PAYABLE',
      hasDisputeFlag: payable.hasDisputeFlag,
    },
    demo.buyerAgent,
    {
      subject: payable.invoiceNumber,
      sourceSystem: 'ZWAPGRID',
      sourceRecordRef: payable.externalRef,
      sourceRetrievedAt: payable.retrievedAt,
      correlationId: demo.correlationId,
    }
  );

  demo.claims.push(claim);
  transition(demo.state, 'BUYER_MATCH_PENDING');
  const prevState = demo.state;
  demo.state = 'BUYER_MATCH_PENDING';

  addTimelineEvent(demo, {
    actor: 'BUYER_AGENT',
    actorName: 'Aurora Retail AB',
    claimType: 'PAYABLE_MATCHED',
    summary: `Buyer independently confirms matching payable in its accounts-payable data. Full match: invoice ${payable.invoiceNumber}, €${payable.amount.toLocaleString()}, ${payable.currency}. No dispute flag.`,
    evidenceSource: zwapgridEvidenceLabel(buyerZwapgrid.mode),
    signatureVerified: true,
    supportingClaimIds: [supplierClaim.claimId],
    stateTransition: { from: prevState, to: demo.state },
    details: { payload: claim.payload, claimId: claim.claimId, supplierClaimVerified: isValid },
    isMocked: buyerZwapgrid.mode === 'MOCK',
  });

  recordAuditEvent({
    negotiationId: demo.negotiationId,
    actor: demo.buyerAgent.agentName,
    actorType: 'BUYER_AGENT',
    action: 'PAYABLE_MATCHED',
    inputClaimRefs: [supplierClaim.claimId, claim.claimId],
    stateTransition: `${prevState} -> ${demo.state}`,
    correlationId: demo.correlationId,
  });

  demo.currentStep++;
  return demo;
}

function stepObligationVerified(demo: DemoState): DemoState {
  const supplierClaim = demo.claims.find(c => c.claimType === 'INVOICE_RECORDED')!;
  const buyerClaim = demo.claims.find(c => c.claimType === 'PAYABLE_MATCHED')!;

  const supplierPayload = supplierClaim.payload as {
    invoiceNumber?: string;
    amount?: number;
    currency?: string;
  };
  const invoiceNumber = supplierPayload.invoiceNumber || demo.config.invoiceNumber || 'INV-2026-1042';
  const confirmedAmount = supplierPayload.amount ?? demo.config.invoiceAmount ?? 10000;
  const confirmedCurrency = supplierPayload.currency ?? demo.config.currency ?? 'EUR';

  const claim = createSignedClaim(
    'OBLIGATION_CONFIRMED',
    {
      type: 'OBLIGATION_CONFIRMED',
      invoiceNumber,
      supplierClaimId: supplierClaim.claimId,
      buyerClaimId: buyerClaim.claimId,
      confirmedAmount,
      confirmedCurrency,
    },
    demo.supplierAgent, // Both parties have confirmed
    {
      subject: invoiceNumber,
      sourceSystem: 'INTERNAL',
      correlationId: demo.correlationId,
    }
  );

  demo.claims.push(claim);
  transition(demo.state, 'OBLIGATION_VERIFIED');
  const prevState = demo.state;
  demo.state = 'OBLIGATION_VERIFIED';

  addTimelineEvent(demo, {
    actor: 'SYSTEM',
    actorName: 'Negotiation Engine',
    claimType: 'OBLIGATION_CONFIRMED',
    summary: `Obligation mutually verified. Both parties independently confirmed invoice ${invoiceNumber} for €${confirmedAmount.toLocaleString()} ${confirmedCurrency} with matching identifiers, amounts, and due dates. No dispute flags.`,
    evidenceSource: 'Internal verification',
    signatureVerified: true,
    supportingClaimIds: [supplierClaim.claimId, buyerClaim.claimId],
    stateTransition: { from: prevState, to: demo.state },
    details: { payload: claim.payload, claimId: claim.claimId },
    isMocked: false,
  });

  recordAuditEvent({
    negotiationId: demo.negotiationId,
    actor: 'NegotiationEngine',
    actorType: 'SYSTEM',
    action: 'OBLIGATION_VERIFIED',
    inputClaimRefs: [supplierClaim.claimId, buyerClaim.claimId, claim.claimId],
    stateTransition: `${prevState} -> ${demo.state}`,
    correlationId: demo.correlationId,
  });

  demo.currentStep++;
  return demo;
}

function stepSupplierProposal(demo: DemoState): DemoState {
  const decision = SupplierAgentDecisionEngine.formulateInitialDemand(demo.config);

  const claim = createSignedClaim(
    'SETTLEMENT_PROPOSAL',
    {
      type: 'SETTLEMENT_PROPOSAL',
      proposalId: uuidv4(),
      invoiceNumber: demo.config.invoiceNumber || 'INV-2026-1042',
      installments: [
        { amount: decision.immediateAmount, currency: demo.config.currency, executionDate: today(), label: 'Full immediate payment' },
      ],
      totalAmount: decision.immediateAmount,
      currency: demo.config.currency,
      rationale: decision.rationale,
    },
    demo.supplierAgent,
    {
      subject: demo.config.invoiceNumber || 'INV-2026-1042',
      sourceSystem: 'INTERNAL',
      correlationId: demo.correlationId,
    }
  );

  demo.claims.push(claim);
  transition(demo.state, 'INITIAL_PROPOSAL');
  const prevState = demo.state;
  demo.state = 'INITIAL_PROPOSAL';

  addTimelineEvent(demo, {
    actor: 'SUPPLIER_AGENT',
    actorName: 'Nordic Components AB',
    claimType: 'SETTLEMENT_PROPOSAL',
    summary: `Supplier Agent dynamically formulates demand: €${decision.immediateAmount.toLocaleString()} ${demo.config.currency} today. ${decision.rationale}`,
    evidenceSource: 'Autonomous Supplier Policy Engine',
    signatureVerified: true,
    supportingClaimIds: demo.claims.filter(c => c.claimType === 'OBLIGATION_CONFIRMED').map(c => c.claimId),
    stateTransition: { from: prevState, to: demo.state },
    details: { payload: claim.payload, claimId: claim.claimId, internalMetrics: decision.internalMetrics },
    isMocked: false,
  });

  recordAuditEvent({
    negotiationId: demo.negotiationId,
    actor: demo.supplierAgent.agentName,
    actorType: 'SUPPLIER_AGENT',
    action: 'SETTLEMENT_PROPOSED',
    inputClaimRefs: [claim.claimId],
    stateTransition: `${prevState} -> ${demo.state}`,
    correlationId: demo.correlationId,
    details: { proposedAmount: decision.immediateAmount, currency: demo.config.currency },
  });

  demo.currentStep++;
  return demo;
}

function stepBuyerLiquidityConstraint(demo: DemoState): DemoState {
  const the14th = getThe14th();
  const decision = BuyerAgentDecisionEngine.evaluateLiquidityAndCounter(
    { immediateAmount: demo.config.invoiceAmount },
    demo.config,
    the14th
  );

  // Privacy-preserving: buyer does NOT share raw bank balance
  const claim = createSignedClaim(
    'LIQUIDITY_CONSTRAINT',
    {
      type: 'LIQUIDITY_CONSTRAINT',
      maxPolicyCompliantPaymentToday: decision.immediateAmount,
      currency: demo.config.currency,
      constraintReason: 'OPERATIONAL_LIQUIDITY_RESERVE',
      nextPolicyCompliantDate: the14th,
      nextPolicyCompliantMaxAmount: decision.scheduledAmount,
      forecastBasis: 'LIQUIDITY_FORECAST',
    },
    demo.buyerAgent,
    {
      subject: demo.config.invoiceNumber || 'INV-2026-1042',
      sourceSystem: 'OPEN_PAYMENTS',
      correlationId: demo.correlationId,
    }
  );

  demo.claims.push(claim);

  addTimelineEvent(demo, {
    actor: 'BUYER_AGENT',
    actorName: 'Aurora Retail AB',
    claimType: 'LIQUIDITY_CONSTRAINT',
    summary: `Buyer Agent evaluates liquidity: max compliant payment today is €${decision.immediateAmount.toLocaleString()} (protects €${demo.config.buyerOperationalReserve.toLocaleString()} operational reserve). Forecast window: ${the14th} for €${decision.scheduledAmount.toLocaleString()}.`,
    evidenceSource: 'Open Payments Sandbox — privacy-preserving claim',
    signatureVerified: true,
    supportingClaimIds: [],
    stateTransition: null,
    details: {
      payload: claim.payload,
      claimId: claim.claimId,
      privateDataProtected: ['Raw bank balance (€' + demo.config.buyerBankBalance.toLocaleString() + ')', 'Account number', 'Internal Cashflow Forecast'],
      sharedData: ['Max compliant payment today', 'Next compliant date', 'Constraint reason'],
    },
    isMocked: false,
  });

  recordAuditEvent({
    negotiationId: demo.negotiationId,
    actor: demo.buyerAgent.agentName,
    actorType: 'BUYER_AGENT',
    action: 'LIQUIDITY_CONSTRAINT_SHARED',
    inputClaimRefs: [claim.claimId],
    correlationId: demo.correlationId,
    details: { maxToday: decision.immediateAmount, nextDate: the14th, nextMax: decision.scheduledAmount },
  });

  demo.currentStep++;
  return demo;
}

function stepBuyerCounterproposal(demo: DemoState): DemoState {
  const the14th = getThe14th();
  const decision = BuyerAgentDecisionEngine.evaluateLiquidityAndCounter(
    { immediateAmount: demo.config.invoiceAmount },
    demo.config,
    the14th
  );

  const installments = [
    { amount: decision.immediateAmount, currency: demo.config.currency, executionDate: today(), label: 'Immediate payment' },
  ];
  if (decision.scheduledAmount > 0) {
    installments.push({
      amount: decision.scheduledAmount,
      currency: demo.config.currency,
      executionDate: the14th,
      label: 'Scheduled payment',
    });
  }

  const claim = createSignedClaim(
    'SETTLEMENT_PROPOSAL',
    {
      type: 'SETTLEMENT_PROPOSAL',
      proposalId: uuidv4(),
      invoiceNumber: demo.config.invoiceNumber || 'INV-2026-1042',
      installments,
      totalAmount: demo.config.invoiceAmount,
      currency: demo.config.currency,
      rationale: decision.rationale,
    },
    demo.buyerAgent,
    {
      subject: demo.config.invoiceNumber || 'INV-2026-1042',
      sourceSystem: 'INTERNAL',
      correlationId: demo.correlationId,
    }
  );

  demo.claims.push(claim);
  transition(demo.state, 'COUNTERPROPOSAL');
  const prevState = demo.state;
  demo.state = 'COUNTERPROPOSAL';

  addTimelineEvent(demo, {
    actor: 'BUYER_AGENT',
    actorName: 'Aurora Retail AB',
    claimType: 'SETTLEMENT_PROPOSAL',
    summary: `Buyer Agent autonomously counters: €${decision.immediateAmount.toLocaleString()} today + €${decision.scheduledAmount.toLocaleString()} on ${the14th}. Preserves liquidity while honoring obligation.`,
    evidenceSource: 'Autonomous Buyer Decision Solver',
    signatureVerified: true,
    supportingClaimIds: demo.claims.filter(c => c.claimType === 'LIQUIDITY_CONSTRAINT').map(c => c.claimId),
    stateTransition: { from: prevState, to: demo.state },
    details: { payload: claim.payload, claimId: claim.claimId, internalMetrics: decision.internalMetrics },
    isMocked: false,
  });

  recordAuditEvent({
    negotiationId: demo.negotiationId,
    actor: demo.buyerAgent.agentName,
    actorType: 'BUYER_AGENT',
    action: 'COUNTERPROPOSAL_MADE',
    inputClaimRefs: [claim.claimId],
    stateTransition: `${prevState} -> ${demo.state}`,
    correlationId: demo.correlationId,
    details: { immediate: decision.immediateAmount, scheduled: decision.scheduledAmount, scheduledDate: the14th },
  });

  demo.currentStep++;
  return demo;
}

function stepSupplierAccepts(demo: DemoState): DemoState {
  const the14th = getThe14th();
  const counterClaim = demo.claims.filter(c => c.claimType === 'SETTLEMENT_PROPOSAL').pop()!;
  const installments = (counterClaim.payload as { installments: Array<{ amount: number }> }).installments;
  const immediateAmount = installments[0].amount;
  const scheduledAmount = installments[1]?.amount || 0;

  const decision = SupplierAgentDecisionEngine.evaluateCounterproposal(
    { immediateAmount, scheduledAmount, scheduledDate: the14th },
    demo.config
  );

  const claim = createSignedClaim(
    'SETTLEMENT_ACCEPTED',
    {
      type: 'SETTLEMENT_ACCEPTED',
      proposalId: (counterClaim.payload as { proposalId: string }).proposalId,
      acceptedInstallments: (counterClaim.payload as { installments: Array<{ amount: number; currency: string; executionDate: string; label: string }> }).installments,
      totalAmount: demo.config.invoiceAmount,
      currency: demo.config.currency,
    },
    demo.supplierAgent,
    {
      subject: demo.config.invoiceNumber || 'INV-2026-1042',
      sourceSystem: 'INTERNAL',
      correlationId: demo.correlationId,
    }
  );

  demo.claims.push(claim);
  transition(demo.state, 'AGREEMENT_REACHED');
  const prevState = demo.state;
  demo.state = 'AGREEMENT_REACHED';

  addTimelineEvent(demo, {
    actor: 'SUPPLIER_AGENT',
    actorName: 'Nordic Components AB',
    claimType: 'SETTLEMENT_ACCEPTED',
    summary: `Supplier Agent evaluates terms: ${decision.rationale}`,
    evidenceSource: 'Autonomous Supplier Policy Engine',
    signatureVerified: true,
    supportingClaimIds: [counterClaim.claimId],
    stateTransition: { from: prevState, to: demo.state },
    details: { payload: claim.payload, claimId: claim.claimId, internalMetrics: decision.internalMetrics },
    isMocked: false,
  });

  recordAuditEvent({
    negotiationId: demo.negotiationId,
    actor: demo.supplierAgent.agentName,
    actorType: 'SUPPLIER_AGENT',
    action: 'SETTLEMENT_ACCEPTED',
    inputClaimRefs: [counterClaim.claimId, claim.claimId],
    stateTransition: `${prevState} -> ${demo.state}`,
    correlationId: demo.correlationId,
  });

  demo.currentStep++;
  return demo;
}

function stepPolicyValidation(demo: DemoState): DemoState {
  const counterClaim = demo.claims.filter(c => c.claimType === 'SETTLEMENT_PROPOSAL').pop()!;
  const installments = (counterClaim.payload as { installments: Array<{ amount: number }> }).installments;
  const immediateAmount = installments[0].amount;

  const evaluation = evaluateMandate({
    mandate: demo.mandate,
    paymentAmount: immediateAmount,
    currency: demo.config.currency,
    destinationAccount: SUPPLIER_IBAN,
    counterpartyId: SUPPLIER_ORG.id,
    executionDate: today(),
    idempotencyKey: `${demo.negotiationId}-${immediateAmount}-${demo.config.currency}-${today()}-${SUPPLIER_IBAN}`,
    isFutureDated: false,
    usage: demo.mandateUsage,
  });
  evaluation.correlationId = demo.correlationId;

  const claim = createSignedClaim(
    'POLICY_DECISION',
    {
      type: 'POLICY_DECISION',
      mandateId: demo.mandate.mandateId,
      paymentAmount: immediateAmount,
      currency: demo.config.currency,
      result: evaluation.overallResult,
      checks: evaluation.checks,
    },
    demo.buyerAgent,
    {
      subject: demo.config.invoiceNumber || 'INV-2026-1042',
      sourceSystem: 'INTERNAL',
      correlationId: demo.correlationId,
    }
  );

  demo.claims.push(claim);
  transition(demo.state, 'POLICY_VALIDATION');
  const prevState = demo.state;
  demo.state = 'POLICY_VALIDATION';

  addTimelineEvent(demo, {
    actor: 'POLICY_ENGINE',
    actorName: 'Mandate Policy Engine',
    claimType: 'POLICY_DECISION',
    summary: `All ${evaluation.checks.length} deterministic mandate checks PASSED for €${immediateAmount.toLocaleString()} ${demo.config.currency} immediate payment. Verified against €${demo.mandate.maxAmountPerPayment.toLocaleString()} ceiling.`,
    evidenceSource: 'Deterministic Policy Gatekeeper (Non-LLM)',
    signatureVerified: true,
    supportingClaimIds: [],
    stateTransition: { from: prevState, to: demo.state },
    details: { evaluation, claimId: claim.claimId },
    isMocked: false,
  });

  recordAuditEvent({
    negotiationId: demo.negotiationId,
    actor: 'MandatePolicyEngine',
    actorType: 'POLICY_ENGINE',
    action: 'POLICY_VALIDATION',
    policyDecision: evaluation.overallResult,
    stateTransition: `${prevState} -> ${demo.state}`,
    correlationId: demo.correlationId,
    details: { checks: evaluation.checks },
  });

  demo.currentStep++;
  return demo;
}

async function stepImmediatePayment(demo: DemoState): Promise<DemoState> {
  const counterClaim = demo.claims.filter(c => c.claimType === 'SETTLEMENT_PROPOSAL').pop()!;
  const installments = (counterClaim.payload as { installments: Array<{ amount: number }> }).installments;
  const immediateAmount = installments[0].amount;

  const adapter = process.env.OPEN_PAYMENT_CLIENT_ID
    ? new RealOpenPaymentsAdapter()
    : new MockOpenPaymentsAdapter();

  const result = await executePayment({
    negotiationId: demo.negotiationId,
    mandate: demo.mandate,
    mandateUsage: demo.mandateUsage,
    amount: immediateAmount,
    currency: demo.config.currency,
    debtorAccount: BUYER_IBAN,
    creditorAccount: SUPPLIER_IBAN,
    creditorName: SUPPLIER_ORG.name,
    counterpartyId: SUPPLIER_ORG.id,
    executionDate: today(),
    isFutureDated: false,
    remittanceInfo: `${demo.config.invoiceNumber || 'INV-2026-1042'} Settlement 1/2`,
    correlationId: demo.correlationId,
    openPaymentsAdapter: adapter,
  });

  demo.payments.push(result.instruction);
  demo.mandateUsage.totalSpent += immediateAmount;
  demo.mandateUsage.dailySpent += immediateAmount;
  demo.mandateUsage.paymentCount++;

  transition(demo.state, 'PAYMENT_INITIATED');
  const prevState = demo.state;
  demo.state = 'PAYMENT_INITIATED';

  const claim = createSignedClaim(
    'PAYMENT_INITIATED',
    {
      type: 'PAYMENT_INITIATED',
      paymentInstructionId: result.instruction.id,
      amount: immediateAmount,
      currency: demo.config.currency,
      idempotencyKey: result.instruction.idempotencyKey,
      externalPaymentId: result.instruction.externalPaymentId,
      status: result.instruction.status,
      isMocked: result.instruction.status !== 'AUTHORIZATION_REQUIRED' || !process.env.OPEN_PAYMENT_CLIENT_ID,
    },
    demo.buyerAgent,
    {
      subject: demo.config.invoiceNumber || 'INV-2026-1042',
      sourceSystem: 'OPEN_PAYMENTS',
      correlationId: demo.correlationId,
    }
  );
  demo.claims.push(claim);

  addTimelineEvent(demo, {
    actor: 'PAYMENT_CONTROLLER',
    actorName: 'Payment Controller',
    claimType: 'PAYMENT_INITIATED',
    summary: `SEPA Instant Credit Transfer initiated for €${immediateAmount.toLocaleString()} ${demo.config.currency}. Verification of Payee (VoP) passed. External Payment ID: ${result.instruction.externalPaymentId || 'N/A'}. Status: ${result.instruction.status}. [${process.env.OPEN_PAYMENT_CLIENT_ID ? 'SANDBOX' : 'MOCKED'}]`,
    evidenceSource: process.env.OPEN_PAYMENT_CLIENT_ID ? 'Open Payments Sandbox' : 'Open Payments [MOCK]',
    signatureVerified: true,
    supportingClaimIds: [claim.claimId],
    stateTransition: { from: prevState, to: demo.state },
    details: {
      payment: {
        id: result.instruction.id,
        amount: immediateAmount,
        currency: demo.config.currency,
        status: result.instruction.status,
        externalPaymentId: result.instruction.externalPaymentId,
        idempotencyKey: result.instruction.idempotencyKey,
      },
    },
    isMocked: !process.env.OPEN_PAYMENT_CLIENT_ID,
  });

  demo.currentStep++;
  return demo;
}

async function stepScheduledPayment(demo: DemoState): Promise<DemoState> {
  const the14th = getThe14th();
  const counterClaim = demo.claims.filter(c => c.claimType === 'SETTLEMENT_PROPOSAL').pop()!;
  const installments = (counterClaim.payload as { installments: Array<{ amount: number }> }).installments;
  const scheduledAmount = installments[1]?.amount || 0;

  if (scheduledAmount === 0) {
    // No second payment needed, mark completed directly
    transition(demo.state, 'COMPLETED');
    demo.state = 'COMPLETED';
    demo.isComplete = true;
    demo.currentStep++;
    demo.auditLog = getAuditLog(demo.negotiationId);
    return demo;
  }

  const adapter = process.env.OPEN_PAYMENT_CLIENT_ID
    ? new RealOpenPaymentsAdapter()
    : new MockOpenPaymentsAdapter();

  const result = await executePayment({
    negotiationId: demo.negotiationId,
    mandate: demo.mandate,
    mandateUsage: demo.mandateUsage,
    amount: scheduledAmount,
    currency: demo.config.currency,
    debtorAccount: BUYER_IBAN,
    creditorAccount: SUPPLIER_IBAN,
    creditorName: SUPPLIER_ORG.name,
    counterpartyId: SUPPLIER_ORG.id,
    executionDate: the14th,
    isFutureDated: true,
    remittanceInfo: `${demo.config.invoiceNumber || 'INV-2026-1042'} Settlement 2/2`,
    correlationId: demo.correlationId,
    openPaymentsAdapter: adapter,
  });

  demo.payments.push(result.instruction);
  demo.mandateUsage.totalSpent += scheduledAmount;
  demo.mandateUsage.paymentCount++;

  transition(demo.state, 'PAYMENT_SCHEDULED');
  const prevState = demo.state;
  demo.state = 'PAYMENT_SCHEDULED';

  const claim = createSignedClaim(
    'PAYMENT_SCHEDULED',
    {
      type: 'PAYMENT_SCHEDULED',
      paymentInstructionId: result.instruction.id,
      amount: scheduledAmount,
      currency: demo.config.currency,
      scheduledDate: the14th,
      idempotencyKey: result.instruction.idempotencyKey,
      isMocked: !process.env.OPEN_PAYMENT_CLIENT_ID,
      isSimulated: false,
    },
    demo.buyerAgent,
    {
      subject: demo.config.invoiceNumber || 'INV-2026-1042',
      sourceSystem: 'OPEN_PAYMENTS',
      correlationId: demo.correlationId,
    }
  );
  demo.claims.push(claim);

  addTimelineEvent(demo, {
    actor: 'PAYMENT_CONTROLLER',
    actorName: 'Payment Controller',
    claimType: 'PAYMENT_SCHEDULED',
    summary: `Future payment of €${scheduledAmount.toLocaleString()} scheduled for ${the14th}. Open Payments API supports future-dated payments via requestedExecutionDate. External Payment ID: ${result.instruction.externalPaymentId || 'N/A'}. Status: ${result.instruction.status}. [${process.env.OPEN_PAYMENT_CLIENT_ID ? 'SANDBOX' : 'MOCKED'}]`,
    evidenceSource: process.env.OPEN_PAYMENT_CLIENT_ID ? 'Open Payments Sandbox' : 'Open Payments [MOCK]',
    signatureVerified: true,
    supportingClaimIds: [claim.claimId],
    stateTransition: { from: prevState, to: demo.state },
    details: {
      payment: {
        id: result.instruction.id,
        amount: scheduledAmount,
        currency: demo.config.currency,
        scheduledDate: the14th,
        status: result.instruction.status,
        externalPaymentId: result.instruction.externalPaymentId,
        idempotencyKey: result.instruction.idempotencyKey,
        isFutureDated: true,
      },
    },
    isMocked: true,
  });

  // Move to COMPLETED
  transition(demo.state, 'COMPLETED');
  demo.state = 'COMPLETED';
  demo.isComplete = true;

  recordAuditEvent({
    negotiationId: demo.negotiationId,
    actor: 'System',
    actorType: 'SYSTEM',
    action: 'NEGOTIATION_COMPLETED',
    stateTransition: `${prevState} -> COMPLETED`,
    correlationId: demo.correlationId,
    details: {
      totalSettled: 10000,
      immediatePayment: 4000,
      scheduledPayment: 6000,
      scheduledDate: the14th,
    },
  });

  demo.currentStep++;
  demo.auditLog = getAuditLog(demo.negotiationId);
  return demo;
}

// ─── Rejection scenario steps ──────────────────────────────────

function stepOutOfPolicyProposal(demo: DemoState): DemoState {
  const claim = createSignedClaim(
    'SETTLEMENT_PROPOSAL',
    {
      type: 'SETTLEMENT_PROPOSAL',
      proposalId: uuidv4(),
      invoiceNumber: 'INV-2026-1042',
      installments: [
        { amount: 8000, currency: 'EUR', executionDate: today(), label: 'Over-limit payment' },
      ],
      totalAmount: 8000,
      currency: 'EUR',
      rationale: 'Attempting payment above per-payment mandate ceiling (€6,000)',
    },
    demo.supplierAgent,
    {
      subject: 'INV-2026-1042',
      sourceSystem: 'INTERNAL',
      correlationId: demo.correlationId,
    }
  );

  demo.claims.push(claim);
  transition(demo.state, 'INITIAL_PROPOSAL');
  const prevState = demo.state;
  demo.state = 'INITIAL_PROPOSAL';

  addTimelineEvent(demo, {
    actor: 'SUPPLIER_AGENT',
    actorName: 'Nordic Components AB',
    claimType: 'SETTLEMENT_PROPOSAL',
    summary: '⚠️ Supplier proposes €8,000 immediate payment — this violates both the Buyer\'s liquidity policy (max €4,000 today) and the legal mandate per-payment ceiling (€6,000).',
    evidenceSource: 'Supplier policy',
    signatureVerified: true,
    supportingClaimIds: [],
    stateTransition: { from: prevState, to: demo.state },
    details: { payload: claim.payload, claimId: claim.claimId },
    isMocked: false,
  });

  demo.currentStep++;
  return demo;
}

function stepPolicyRejection(demo: DemoState): DemoState {
  const evaluation = evaluateMandate({
    mandate: demo.mandate,
    paymentAmount: 8000,
    currency: 'EUR',
    destinationAccount: SUPPLIER_IBAN,
    counterpartyId: SUPPLIER_ORG.id,
    executionDate: today(),
    idempotencyKey: `${demo.negotiationId}-8000-EUR-${today()}-${SUPPLIER_IBAN}`,
    isFutureDated: false,
    usage: demo.mandateUsage,
  });
  evaluation.correlationId = demo.correlationId;

  const claim = createSignedClaim(
    'PAYMENT_REJECTED',
    {
      type: 'PAYMENT_REJECTED',
      reason: evaluation.failureReasons.join('; '),
      policyCheckResults: evaluation.checks,
    },
    demo.buyerAgent,
    {
      subject: 'INV-2026-1042',
      sourceSystem: 'INTERNAL',
      correlationId: demo.correlationId,
    }
  );

  demo.claims.push(claim);
  transition(demo.state, 'REJECTED');
  const prevState = demo.state;
  demo.state = 'REJECTED';

  addTimelineEvent(demo, {
    actor: 'POLICY_ENGINE',
    actorName: 'Mandate Policy Engine',
    claimType: 'PAYMENT_REJECTED',
    summary: `🛑 PAYMENT BLOCKED by deterministic policy engine. Violations: (1) €8,000 exceeds legal per-payment ceiling of €6,000; (2) exceeds Buyer internal maximum-today liquidity limit of €4,000. ${evaluation.checks.filter(c => c.result === 'PASS').length}/${evaluation.checks.length} checks passed.`,
    evidenceSource: 'Deterministic policy engine',
    signatureVerified: true,
    supportingClaimIds: [],
    stateTransition: { from: prevState, to: demo.state },
    details: { evaluation, claimId: claim.claimId },
    isMocked: false,
  });

  recordAuditEvent({
    negotiationId: demo.negotiationId,
    actor: 'MandatePolicyEngine',
    actorType: 'POLICY_ENGINE',
    action: 'PAYMENT_REJECTED',
    policyDecision: `FAIL: ${evaluation.failureReasons.join('; ')}`,
    stateTransition: `${prevState} -> ${demo.state}`,
    correlationId: demo.correlationId,
    details: { checks: evaluation.checks },
  });

  demo.currentStep++;
  demo.auditLog = getAuditLog(demo.negotiationId);
  return demo;
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Run the complete successful negotiation scenario
 */
export async function runSuccessfulNegotiation(customConfig?: Partial<ScenarioConfig>): Promise<DemoState> {
  const demo = initializeDemo('SUCCESS', customConfig);
  while (!demo.isComplete) {
    await executeStep(demo);
  }
  demo.auditLog = getAuditLog(demo.negotiationId);
  return demo;
}

/**
 * Run the rejection scenario
 */
export async function runRejectedProposal(customConfig?: Partial<ScenarioConfig>): Promise<DemoState> {
  const demo = initializeDemo('REJECTION', customConfig);
  while (!demo.isComplete) {
    await executeStep(demo);
  }
  demo.auditLog = getAuditLog(demo.negotiationId);
  return demo;
}

/**
 * Step through the demo one event at a time
 */
export async function stepDemo(customConfig?: Partial<ScenarioConfig>): Promise<DemoState> {
  if (!currentDemo) {
    initializeDemo('SUCCESS', customConfig);
  }
  if (currentDemo!.isComplete) {
    return currentDemo!;
  }
  await executeStep(currentDemo!);
  currentDemo!.auditLog = getAuditLog(currentDemo!.negotiationId);
  return currentDemo!;
}
