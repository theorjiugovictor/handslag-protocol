// ─── Claim Types ───────────────────────────────────────────────

export const CLAIM_TYPES = [
  'INVOICE_RECORDED',
  'PAYABLE_MATCHED',
  'OBLIGATION_CONFIRMED',
  'INVOICE_UNPAID',
  'DISPUTE_STATUS',
  'LIQUIDITY_CONSTRAINT',
  'SETTLEMENT_PROPOSAL',
  'SETTLEMENT_ACCEPTED',
  'POLICY_DECISION',
  'PAYMENT_INITIATED',
  'PAYMENT_SCHEDULED',
  'PAYMENT_REJECTED',
] as const;

export type ClaimType = typeof CLAIM_TYPES[number];

export const VERIFICATION_STATUSES = ['UNVERIFIED', 'VERIFIED', 'FAILED'] as const;
export type VerificationStatus = typeof VERIFICATION_STATUSES[number];

export interface ClaimEnvelope {
  claimId: string;
  claimType: ClaimType;
  issuerAgentId: string;
  issuerAgentName: string;
  issuerOrganization: string;
  issuerOrganizationId: string;
  subject: string; // e.g., invoice number or negotiation ref
  payload: ClaimPayload;
  sourceSystem: 'ZWAPGRID' | 'OPEN_PAYMENTS' | 'INTERNAL';
  sourceRecordRef: string | null;
  sourceRetrievedAt: string | null; // ISO timestamp
  evidenceHash: string;
  issuedAt: string; // ISO timestamp
  expiresAt: string | null;
  correlationId: string;
  signature: string;
  signatureAlgorithm: 'Ed25519';
  verificationStatus: VerificationStatus;
}

// ─── Claim Payloads ────────────────────────────────────────────

export type ClaimPayload =
  | InvoiceRecordedPayload
  | PayableMatchedPayload
  | ObligationConfirmedPayload
  | InvoiceUnpaidPayload
  | DisputeStatusPayload
  | LiquidityConstraintPayload
  | SettlementProposalPayload
  | SettlementAcceptedPayload
  | PolicyDecisionPayload
  | PaymentInitiatedPayload
  | PaymentScheduledPayload
  | PaymentRejectedPayload;

export interface InvoiceRecordedPayload {
  type: 'INVOICE_RECORDED';
  invoiceNumber: string;
  supplierOrg: string;
  buyerOrg: string;
  amount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  daysOverdue: number;
  /** This is a signed claim based on the supplier's ledger, not proof the invoice is real */
  ledgerBasis: 'SUPPLIER_ACCOUNTS_RECEIVABLE';
}

export interface PayableMatchedPayload {
  type: 'PAYABLE_MATCHED';
  invoiceNumber: string;
  supplierOrg: string;
  buyerOrg: string;
  matchedAmount: number;
  matchedCurrency: string;
  matchedDueDate: string;
  matchResult: 'FULL_MATCH' | 'PARTIAL_MATCH' | 'NO_MATCH';
  /** Buyer independently verified against its own accounts-payable data */
  verificationBasis: 'BUYER_ACCOUNTS_PAYABLE';
  hasDisputeFlag: boolean;
}

export interface ObligationConfirmedPayload {
  type: 'OBLIGATION_CONFIRMED';
  invoiceNumber: string;
  supplierClaimId: string;
  buyerClaimId: string;
  confirmedAmount: number;
  confirmedCurrency: string;
}

export interface InvoiceUnpaidPayload {
  type: 'INVOICE_UNPAID';
  invoiceNumber: string;
  outstandingAmount: number;
  currency: string;
  lastPaymentCheck: string;
}

export interface DisputeStatusPayload {
  type: 'DISPUTE_STATUS';
  invoiceNumber: string;
  isDisputed: boolean;
  disputeReason: string | null;
}

export interface LiquidityConstraintPayload {
  type: 'LIQUIDITY_CONSTRAINT';
  /** Privacy-preserving: does NOT expose raw bank balance */
  maxPolicyCompliantPaymentToday: number;
  currency: string;
  constraintReason: 'OPERATIONAL_LIQUIDITY_RESERVE';
  /** Liquidity forecast, not guaranteed future funds */
  nextPolicyCompliantDate: string | null;
  nextPolicyCompliantMaxAmount: number | null;
  forecastBasis: 'LIQUIDITY_FORECAST' | 'BOOKED_INCOMING';
}

export interface SettlementProposalPayload {
  type: 'SETTLEMENT_PROPOSAL';
  proposalId: string;
  invoiceNumber: string;
  installments: Installment[];
  totalAmount: number;
  currency: string;
  rationale: string;
}

export interface Installment {
  amount: number;
  currency: string;
  executionDate: string; // ISO date
  label: string; // e.g., "Immediate payment" or "Scheduled payment"
}

export interface SettlementAcceptedPayload {
  type: 'SETTLEMENT_ACCEPTED';
  proposalId: string;
  acceptedInstallments: Installment[];
  totalAmount: number;
  currency: string;
}

export interface PolicyDecisionPayload {
  type: 'POLICY_DECISION';
  mandateId: string;
  paymentAmount: number;
  currency: string;
  result: 'PASS' | 'FAIL';
  checks: PolicyCheck[];
}

export interface PolicyCheck {
  checkName: string;
  description: string;
  result: 'PASS' | 'FAIL';
  actual: string;
  limit: string;
}

export interface PaymentInitiatedPayload {
  type: 'PAYMENT_INITIATED';
  paymentInstructionId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
  externalPaymentId: string | null;
  status: PaymentStatus;
  isMocked: boolean;
}

export interface PaymentScheduledPayload {
  type: 'PAYMENT_SCHEDULED';
  paymentInstructionId: string;
  amount: number;
  currency: string;
  scheduledDate: string;
  idempotencyKey: string;
  isMocked: boolean;
  /** Whether the API actually supports future-dated payments */
  isSimulated: boolean;
}

export interface PaymentRejectedPayload {
  type: 'PAYMENT_REJECTED';
  reason: string;
  policyCheckResults: PolicyCheck[];
}

// ─── Payment Status ────────────────────────────────────────────

export const PAYMENT_STATUSES = [
  'CREATED',
  'AUTHORIZATION_REQUIRED',
  'SUBMITTED',
  'BOOKED',
  'FAILED',
  'CANCELLED',
] as const;

export type PaymentStatus = typeof PAYMENT_STATUSES[number];
