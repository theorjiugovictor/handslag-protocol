/**
 * PaymentController
 * 
 * NON-NEGOTIABLE SAFETY RULE: An LLM must NEVER authorize or execute a payment.
 * Only this deterministic code may initiate payments, and ONLY after the
 * MandatePolicyEngine has approved the instruction.
 * 
 * The PaymentController rejects any instruction that has not passed the
 * MandatePolicyEngine. It enforces idempotency and prevents duplicate execution.
 */

import { v4 as uuidv4 } from 'uuid';
import type { IOpenPaymentsAdapter, PaymentInitiationResponse } from '@/lib/adapters/open-payments-adapter.interface';
import type { Mandate, MandateEvaluation, MandateUsage } from '@/lib/types/mandate';
import { evaluateMandate, recordExecutedPayment } from './mandate-policy-engine';
import { recordAuditEvent } from './audit-service';

export interface PaymentInstruction {
  id: string;
  negotiationId: string;
  idempotencyKey: string;
  amount: number;
  currency: string;
  debtorAccount: string;
  creditorAccount: string;
  creditorName: string;
  executionDate: string;
  isFutureDated: boolean;
  remittanceInfo: string;
  status: 'CREATED' | 'AUTHORIZATION_REQUIRED' | 'SUBMITTED' | 'BOOKED' | 'FAILED' | 'CANCELLED';
  externalPaymentId: string | null;
  policyEvaluation: MandateEvaluation | null;
  isMocked: boolean;
  createdAt: string;
}

// In-memory payment store
const paymentInstructions = new Map<string, PaymentInstruction>();
const idempotencyIndex = new Map<string, string>(); // key -> instruction ID

/**
 * Execute a payment through the mandate-validated pipeline.
 * 
 * Flow:
 * 1. Check idempotency (return existing if duplicate)
 * 2. Run MandatePolicyEngine checks
 * 3. If FAIL → reject, record audit, return
 * 4. If PASS → initiate via OpenPaymentsAdapter
 * 5. Record payment and audit events
 */
export async function executePayment(params: {
  negotiationId: string;
  mandate: Mandate;
  mandateUsage: MandateUsage;
  amount: number;
  currency: string;
  debtorAccount: string;
  creditorAccount: string;
  creditorName: string;
  counterpartyId: string;
  executionDate: string;
  isFutureDated: boolean;
  remittanceInfo: string;
  correlationId: string;
  openPaymentsAdapter: IOpenPaymentsAdapter;
}): Promise<{
  instruction: PaymentInstruction;
  policyEvaluation: MandateEvaluation;
  apiResponse: PaymentInitiationResponse | null;
}> {
  // Generate deterministic idempotency key
  const idempotencyKey = `${params.negotiationId}-${params.amount}-${params.currency}-${params.executionDate}-${params.creditorAccount}`;

  // 1. Check idempotency
  const existingId = idempotencyIndex.get(idempotencyKey);
  if (existingId) {
    const existing = paymentInstructions.get(existingId)!;
    recordAuditEvent({
      negotiationId: params.negotiationId,
      actor: 'PaymentController',
      actorType: 'PAYMENT_CONTROLLER',
      action: 'DUPLICATE_PAYMENT_BLOCKED',
      correlationId: params.correlationId,
      details: { idempotencyKey, existingInstructionId: existingId },
    });
    return {
      instruction: existing,
      policyEvaluation: existing.policyEvaluation!,
      apiResponse: null,
    };
  }

  // 2. Run mandate policy checks
  const policyEvaluation = evaluateMandate({
    mandate: params.mandate,
    paymentAmount: params.amount,
    currency: params.currency,
    destinationAccount: params.creditorAccount,
    counterpartyId: params.counterpartyId,
    executionDate: params.executionDate,
    idempotencyKey,
    isFutureDated: params.isFutureDated,
    usage: params.mandateUsage,
  });
  policyEvaluation.correlationId = params.correlationId;

  const instructionId = uuidv4();

  // 3. If FAIL → reject
  if (policyEvaluation.overallResult === 'FAIL') {
    const instruction: PaymentInstruction = {
      id: instructionId,
      negotiationId: params.negotiationId,
      idempotencyKey,
      amount: params.amount,
      currency: params.currency,
      debtorAccount: params.debtorAccount,
      creditorAccount: params.creditorAccount,
      creditorName: params.creditorName,
      executionDate: params.executionDate,
      isFutureDated: params.isFutureDated,
      remittanceInfo: params.remittanceInfo,
      status: 'FAILED',
      externalPaymentId: null,
      policyEvaluation,
      isMocked: params.openPaymentsAdapter.mode === 'MOCK',
      createdAt: new Date().toISOString(),
    };

    paymentInstructions.set(instructionId, instruction);

    recordAuditEvent({
      negotiationId: params.negotiationId,
      actor: 'PaymentController',
      actorType: 'PAYMENT_CONTROLLER',
      action: 'PAYMENT_REJECTED_BY_POLICY',
      policyDecision: `FAIL: ${policyEvaluation.failureReasons.join('; ')}`,
      correlationId: params.correlationId,
      details: {
        amount: params.amount,
        currency: params.currency,
        checks: policyEvaluation.checks,
      },
    });

    return { instruction, policyEvaluation, apiResponse: null };
  }

  // 4. PASS → Verification of Payee (VoP) Pre-Flight Check
  const vopResult = await params.openPaymentsAdapter.verifyPayee({
    creditorIban: params.creditorAccount,
    creditorName: params.creditorName,
  });

  if (vopResult.matchResult === 'NO_MATCH') {
    const instruction: PaymentInstruction = {
      id: instructionId,
      negotiationId: params.negotiationId,
      idempotencyKey,
      amount: params.amount,
      currency: params.currency,
      debtorAccount: params.debtorAccount,
      creditorAccount: params.creditorAccount,
      creditorName: params.creditorName,
      executionDate: params.executionDate,
      isFutureDated: params.isFutureDated,
      remittanceInfo: params.remittanceInfo,
      status: 'FAILED',
      externalPaymentId: null,
      policyEvaluation,
      isMocked: params.openPaymentsAdapter.mode === 'MOCK',
      createdAt: new Date().toISOString(),
    };

    paymentInstructions.set(instructionId, instruction);

    recordAuditEvent({
      negotiationId: params.negotiationId,
      actor: 'PaymentController',
      actorType: 'PAYMENT_CONTROLLER',
      action: 'PAYEE_VERIFICATION_FAILED',
      policyDecision: 'FAIL: Verification of Payee (VoP) mismatch — suspected IBAN tampering',
      correlationId: params.correlationId,
      details: { vopResult },
    });

    return { instruction, policyEvaluation, apiResponse: null };
  }

  recordAuditEvent({
    negotiationId: params.negotiationId,
    actor: 'PaymentController',
    actorType: 'PAYMENT_CONTROLLER',
    action: 'POLICY_CHECKS_PASSED',
    policyDecision: 'PASS',
    correlationId: params.correlationId,
    details: { checks: policyEvaluation.checks, payeeVerified: vopResult.matchResult },
  });

  let apiResponse: PaymentInitiationResponse;
  try {
    apiResponse = await params.openPaymentsAdapter.initiatePayment(
      {
        debtorAccount: { iban: params.debtorAccount, currency: params.currency },
        creditorAccount: { iban: params.creditorAccount },
        creditorName: params.creditorName,
        instructedAmount: { amount: params.amount.toFixed(2), currency: params.currency },
        remittanceInformationUnstructured: params.remittanceInfo,
        requestedExecutionDate: params.isFutureDated ? params.executionDate : undefined,
        endToEndIdentification: idempotencyKey.slice(0, 35),
      },
      idempotencyKey
    );
  } catch (error) {
    const instruction: PaymentInstruction = {
      id: instructionId,
      negotiationId: params.negotiationId,
      idempotencyKey,
      amount: params.amount,
      currency: params.currency,
      debtorAccount: params.debtorAccount,
      creditorAccount: params.creditorAccount,
      creditorName: params.creditorName,
      executionDate: params.executionDate,
      isFutureDated: params.isFutureDated,
      remittanceInfo: params.remittanceInfo,
      status: 'FAILED',
      externalPaymentId: null,
      policyEvaluation,
      isMocked: params.openPaymentsAdapter.mode === 'MOCK',
      createdAt: new Date().toISOString(),
    };

    paymentInstructions.set(instructionId, instruction);

    recordAuditEvent({
      negotiationId: params.negotiationId,
      actor: 'PaymentController',
      actorType: 'PAYMENT_CONTROLLER',
      action: 'PAYMENT_API_ERROR',
      paymentResult: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
      correlationId: params.correlationId,
    });

    return { instruction, policyEvaluation, apiResponse: null };
  }

  // 5. Record payment
  const status = apiResponse.scaRequired ? 'AUTHORIZATION_REQUIRED' : 'SUBMITTED';
  const instruction: PaymentInstruction = {
    id: instructionId,
    negotiationId: params.negotiationId,
    idempotencyKey,
    amount: params.amount,
    currency: params.currency,
    debtorAccount: params.debtorAccount,
    creditorAccount: params.creditorAccount,
    creditorName: params.creditorName,
    executionDate: params.executionDate,
    isFutureDated: params.isFutureDated,
    remittanceInfo: params.remittanceInfo,
    status,
    externalPaymentId: apiResponse.paymentId,
    policyEvaluation,
    isMocked: apiResponse.isMocked,
    createdAt: new Date().toISOString(),
  };

  paymentInstructions.set(instructionId, instruction);
  idempotencyIndex.set(idempotencyKey, instructionId);
  recordExecutedPayment(idempotencyKey);

  recordAuditEvent({
    negotiationId: params.negotiationId,
    actor: 'PaymentController',
    actorType: 'PAYMENT_CONTROLLER',
    action: params.isFutureDated ? 'PAYMENT_SCHEDULED' : 'PAYMENT_INITIATED',
    paymentResult: `${status} - ${apiResponse.paymentId}${apiResponse.isMocked ? ' [MOCKED]' : ''}`,
    correlationId: params.correlationId,
    details: {
      paymentId: apiResponse.paymentId,
      amount: params.amount,
      currency: params.currency,
      executionDate: params.executionDate,
      isFutureDated: params.isFutureDated,
      scaRequired: apiResponse.scaRequired,
      isMocked: apiResponse.isMocked,
    },
  });

  return { instruction, policyEvaluation, apiResponse };
}

/**
 * Get a payment instruction by ID
 */
export function getPaymentInstruction(id: string): PaymentInstruction | undefined {
  return paymentInstructions.get(id);
}

/**
 * Get all payment instructions for a negotiation
 */
export function getPaymentInstructions(negotiationId: string): PaymentInstruction[] {
  return Array.from(paymentInstructions.values()).filter(
    p => p.negotiationId === negotiationId
  );
}

/**
 * Clear all payment data (for demo reset)
 */
export function clearPaymentData(): void {
  paymentInstructions.clear();
  idempotencyIndex.clear();
}
