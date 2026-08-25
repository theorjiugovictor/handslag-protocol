// ─── Mandate Types ─────────────────────────────────────────────

export interface Mandate {
  mandateId: string;
  mandateVersion: number;
  principal: {
    organizationId: string;
    organizationName: string;
  };
  authorizedAgentId: string;
  sourceAccount: string; // masked IBAN
  approvedCounterpartyIds: string[];
  approvedDestination: string; // masked IBAN or verified ref
  allowedCurrencies: string[];
  maxAmountPerPayment: number;
  maxCumulativeAmount: number;
  maxDailyAmount: number;
  earliestExecDate: string; // ISO date
  latestExecDate: string; // ISO date
  futureDatedAllowed: boolean;
  effectiveAt: string; // ISO timestamp
  expiresAt: string; // ISO timestamp
  revoked: boolean;
  revokedAt: string | null;
  createdBy: string;
  signedAt: string; // ISO timestamp
  signatureMetadata: MandateSignatureMetadata;
}

export interface MandateSignatureMetadata {
  /** Demo mode: human-readable signature description */
  type: 'DEMO_SIGNATURE' | 'PRODUCTION_SIGNATURE';
  algorithm: string;
  signedBy: string;
  signedFields: string[];
  /** In demo mode, a deterministic hash of the mandate fields */
  signatureValue: string;
}

export interface MandatePolicyCheckResult {
  checkName: string;
  description: string;
  result: 'PASS' | 'FAIL';
  actual: string;
  limit: string;
}

export interface MandateEvaluation {
  mandateId: string;
  paymentAmount: number;
  currency: string;
  overallResult: 'PASS' | 'FAIL';
  checks: MandatePolicyCheckResult[];
  failureReasons: string[];
  evaluatedAt: string;
  correlationId: string;
}

// ─── Cumulative tracking ───────────────────────────────────────

export interface MandateUsage {
  mandateId: string;
  totalSpent: number;
  dailySpent: number;
  dailyDate: string; // ISO date for daily reset
  paymentCount: number;
}
