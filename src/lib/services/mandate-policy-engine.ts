/**
 * MandatePolicyEngine
 * 
 * Deterministic policy enforcement. An LLM must NEVER authorize payments.
 * Only this deterministic code validates mandates and checks constraints.
 * 
 * The PaymentController must reject any instruction that has not passed
 * this engine.
 */

import type { Mandate, MandateEvaluation, MandatePolicyCheckResult, MandateUsage } from '@/lib/types/mandate';
import { checkLienSync } from './lien-registry';

export interface PolicyCheckInput {
  mandate: Mandate;
  paymentAmount: number;
  currency: string;
  destinationAccount: string;
  counterpartyId: string;
  executionDate: string; // ISO date
  idempotencyKey: string;
  isFutureDated: boolean;
  usage: MandateUsage;
}

// Track executed payment idempotency keys
const executedPayments = new Set<string>();

/**
 * Evaluate a payment instruction against a mandate.
 * Returns individual check results.
 */
export function evaluateMandate(input: PolicyCheckInput): MandateEvaluation {
  const checks: MandatePolicyCheckResult[] = [];
  const failureReasons: string[] = [];
  const now = new Date().toISOString();

  // 1. Mandate not revoked
  const revokedCheck: MandatePolicyCheckResult = {
    checkName: 'MANDATE_NOT_REVOKED',
    description: 'Mandate must not be revoked',
    result: input.mandate.revoked ? 'FAIL' : 'PASS',
    actual: input.mandate.revoked ? 'REVOKED' : 'ACTIVE',
    limit: 'ACTIVE',
  };
  checks.push(revokedCheck);
  if (revokedCheck.result === 'FAIL') failureReasons.push('Mandate has been revoked');

  // 2. Mandate not expired
  const isExpired = new Date(input.mandate.expiresAt) < new Date();
  const expiryCheck: MandatePolicyCheckResult = {
    checkName: 'MANDATE_NOT_EXPIRED',
    description: 'Mandate must not be expired',
    result: isExpired ? 'FAIL' : 'PASS',
    actual: isExpired ? 'EXPIRED' : `Valid until ${input.mandate.expiresAt}`,
    limit: `Before ${input.mandate.expiresAt}`,
  };
  checks.push(expiryCheck);
  if (expiryCheck.result === 'FAIL') failureReasons.push('Mandate has expired');

  // 3. Amount per payment
  const amountCheck: MandatePolicyCheckResult = {
    checkName: 'AMOUNT_PER_PAYMENT',
    description: 'Payment must not exceed per-payment ceiling',
    result: input.paymentAmount <= input.mandate.maxAmountPerPayment ? 'PASS' : 'FAIL',
    actual: `€${input.paymentAmount.toLocaleString()}`,
    limit: `€${input.mandate.maxAmountPerPayment.toLocaleString()}`,
  };
  checks.push(amountCheck);
  if (amountCheck.result === 'FAIL') failureReasons.push(`Amount €${input.paymentAmount} exceeds per-payment ceiling €${input.mandate.maxAmountPerPayment}`);

  // 4. Cumulative amount
  const newCumulative = input.usage.totalSpent + input.paymentAmount;
  const cumulativeCheck: MandatePolicyCheckResult = {
    checkName: 'CUMULATIVE_AMOUNT',
    description: 'Total payments must not exceed cumulative ceiling',
    result: newCumulative <= input.mandate.maxCumulativeAmount ? 'PASS' : 'FAIL',
    actual: `€${newCumulative.toLocaleString()} (€${input.usage.totalSpent.toLocaleString()} spent + €${input.paymentAmount.toLocaleString()})`,
    limit: `€${input.mandate.maxCumulativeAmount.toLocaleString()}`,
  };
  checks.push(cumulativeCheck);
  if (cumulativeCheck.result === 'FAIL') failureReasons.push(`Cumulative €${newCumulative} exceeds ceiling €${input.mandate.maxCumulativeAmount}`);

  // 5. Daily amount (evaluated per execution date)
  const execDay = input.executionDate.split('T')[0];
  const dailySpent = (input.usage.dailyDate === execDay) ? input.usage.dailySpent : 0;
  const newDaily = dailySpent + input.paymentAmount;
  const dailyCheck: MandatePolicyCheckResult = {
    checkName: 'DAILY_AMOUNT',
    description: 'Daily payments must not exceed daily ceiling for execution date',
    result: newDaily <= input.mandate.maxDailyAmount ? 'PASS' : 'FAIL',
    actual: `€${newDaily.toLocaleString()} on ${execDay}`,
    limit: `€${input.mandate.maxDailyAmount.toLocaleString()} per day`,
  };
  checks.push(dailyCheck);
  if (dailyCheck.result === 'FAIL') failureReasons.push(`Daily total €${newDaily} on ${execDay} exceeds ceiling €${input.mandate.maxDailyAmount}`);

  // 6. Approved counterparty
  const counterpartyApproved = input.mandate.approvedCounterpartyIds.includes(input.counterpartyId);
  const counterpartyCheck: MandatePolicyCheckResult = {
    checkName: 'APPROVED_COUNTERPARTY',
    description: 'Counterparty must be on the approved list',
    result: counterpartyApproved ? 'PASS' : 'FAIL',
    actual: input.counterpartyId,
    limit: `Approved: ${input.mandate.approvedCounterpartyIds.join(', ')}`,
  };
  checks.push(counterpartyCheck);
  if (counterpartyCheck.result === 'FAIL') failureReasons.push(`Counterparty ${input.counterpartyId} not approved`);

  // 7. Approved destination account
  const destApproved = input.destinationAccount === input.mandate.approvedDestination;
  const destCheck: MandatePolicyCheckResult = {
    checkName: 'APPROVED_DESTINATION',
    description: 'Destination account must match approved account',
    result: destApproved ? 'PASS' : 'FAIL',
    actual: input.destinationAccount,
    limit: input.mandate.approvedDestination,
  };
  checks.push(destCheck);
  if (destCheck.result === 'FAIL') failureReasons.push('Destination account does not match approved account');

  // 8. Allowed currency
  const currencyAllowed = input.mandate.allowedCurrencies.includes(input.currency);
  const currencyCheck: MandatePolicyCheckResult = {
    checkName: 'ALLOWED_CURRENCY',
    description: 'Currency must be in the allowed list',
    result: currencyAllowed ? 'PASS' : 'FAIL',
    actual: input.currency,
    limit: `Allowed: ${input.mandate.allowedCurrencies.join(', ')}`,
  };
  checks.push(currencyCheck);
  if (currencyCheck.result === 'FAIL') failureReasons.push(`Currency ${input.currency} not allowed`);

  // 9. Execution date within bounds
  const execDate = new Date(input.executionDate);
  const earliest = new Date(input.mandate.earliestExecDate);
  const latest = new Date(input.mandate.latestExecDate);
  const dateInBounds = execDate >= earliest && execDate <= latest;
  const dateCheck: MandatePolicyCheckResult = {
    checkName: 'EXECUTION_DATE',
    description: 'Execution date must be within permitted range',
    result: dateInBounds ? 'PASS' : 'FAIL',
    actual: input.executionDate,
    limit: `${input.mandate.earliestExecDate} to ${input.mandate.latestExecDate}`,
  };
  checks.push(dateCheck);
  if (dateCheck.result === 'FAIL') failureReasons.push(`Execution date ${input.executionDate} outside permitted range`);

  // 10. Future-dated allowed
  if (input.isFutureDated) {
    const futureCheck: MandatePolicyCheckResult = {
      checkName: 'FUTURE_DATED_ALLOWED',
      description: 'Future-dated payments must be permitted by mandate',
      result: input.mandate.futureDatedAllowed ? 'PASS' : 'FAIL',
      actual: 'Future-dated payment',
      limit: input.mandate.futureDatedAllowed ? 'Allowed' : 'Not allowed',
    };
    checks.push(futureCheck);
    if (futureCheck.result === 'FAIL') failureReasons.push('Future-dated payments not allowed by mandate');
  }

  // 11. Duplicate instruction detection
  const isDuplicate = executedPayments.has(input.idempotencyKey);
  const duplicateCheck: MandatePolicyCheckResult = {
    checkName: 'NO_DUPLICATE',
    description: 'Payment instruction must not be a duplicate',
    result: isDuplicate ? 'FAIL' : 'PASS',
    actual: isDuplicate ? 'DUPLICATE' : 'UNIQUE',
    limit: 'UNIQUE',
  };
  checks.push(duplicateCheck);
  if (duplicateCheck.result === 'FAIL') failureReasons.push('Duplicate payment instruction detected');

  // 12. Receivable Double-Financing Shield (TransCare fraud typology prevention)
  const doubleFinancingDetected = checkLienSync(
    input.mandate.approvedDestination, // Use destination as invoice proxy in sync context
    input.counterpartyId
  );
  const doubleFinancingCheck: MandatePolicyCheckResult = {
    checkName: 'RECEIVABLE_INTEGRITY_SHIELD',
    description: 'Receivable must not be pledged to multiple financiers or settled concurrently',
    result: doubleFinancingDetected ? 'FAIL' : 'PASS',
    actual: doubleFinancingDetected ? 'COMPETING_LIEN_DETECTED' : 'VERIFIED_SINGLE_LIEN',
    limit: 'SINGLE_CREDITOR_LOCK',
  };
  checks.push(doubleFinancingCheck);
  if (doubleFinancingCheck.result === 'FAIL') failureReasons.push('Receivable double-financing detected — invoice already under active lien by another creditor');

  const overallResult = checks.every(c => c.result === 'PASS') ? 'PASS' : 'FAIL';

  return {
    mandateId: input.mandate.mandateId,
    paymentAmount: input.paymentAmount,
    currency: input.currency,
    overallResult,
    checks,
    failureReasons,
    evaluatedAt: now,
    correlationId: '', // Set by caller
  };
}

/**
 * Record a payment as executed (for duplicate detection)
 */
export function recordExecutedPayment(idempotencyKey: string): void {
  executedPayments.add(idempotencyKey);
}

/**
 * Clear executed payments (for demo reset)
 */
export function clearExecutedPayments(): void {
  executedPayments.clear();
}
