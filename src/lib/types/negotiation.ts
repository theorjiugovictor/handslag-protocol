// ─── Negotiation States ────────────────────────────────────────

export const NEGOTIATION_STATES = [
  'EVIDENCE_REQUESTED',
  'SUPPLIER_EVIDENCE_PRESENTED',
  'BUYER_MATCH_PENDING',
  'OBLIGATION_VERIFIED',
  'DISPUTED',
  'INITIAL_PROPOSAL',
  'COUNTERPROPOSAL',
  'AGREEMENT_REACHED',
  'POLICY_VALIDATION',
  'PAYMENT_INITIATED',
  'PAYMENT_SCHEDULED',
  'COMPLETED',
  'REJECTED',
  'ESCALATED',
] as const;

export type NegotiationState = typeof NEGOTIATION_STATES[number];

// ─── State Transition Map (explicit FSM) ───────────────────────

export const VALID_TRANSITIONS: Record<NegotiationState, NegotiationState[]> = {
  EVIDENCE_REQUESTED: ['SUPPLIER_EVIDENCE_PRESENTED'],
  SUPPLIER_EVIDENCE_PRESENTED: ['BUYER_MATCH_PENDING'],
  BUYER_MATCH_PENDING: ['OBLIGATION_VERIFIED', 'DISPUTED'],
  OBLIGATION_VERIFIED: ['INITIAL_PROPOSAL'],
  DISPUTED: ['ESCALATED'],
  INITIAL_PROPOSAL: ['COUNTERPROPOSAL', 'AGREEMENT_REACHED', 'REJECTED'],
  COUNTERPROPOSAL: ['AGREEMENT_REACHED', 'COUNTERPROPOSAL', 'REJECTED'],
  AGREEMENT_REACHED: ['POLICY_VALIDATION'],
  POLICY_VALIDATION: ['PAYMENT_INITIATED', 'REJECTED'],
  PAYMENT_INITIATED: ['PAYMENT_SCHEDULED', 'COMPLETED'],
  PAYMENT_SCHEDULED: ['COMPLETED'],
  COMPLETED: [],
  REJECTED: [],
  ESCALATED: [],
};

// ─── Proposal ──────────────────────────────────────────────────

export interface Installment {
  amount: number;
  currency: string;
  executionDate: string; // ISO date
  label: string;
}

export interface SettlementProposal {
  proposalId: string;
  invoiceId: string;
  invoiceNumber: string;
  installments: Installment[];
  totalAmount: number;
  currency: string;
  proposerOrgId: string;
  proposerRole: 'SUPPLIER' | 'BUYER';
  expiresAt: string; // ISO timestamp
  rationaleCode: 'INITIAL' | 'LIQUIDITY_CONSTRAINED' | 'ACCEPTED' | 'REJECTED';
  supportingClaimIds: string[];
  sequenceNumber: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'SUPERSEDED';
}

// ─── Negotiation Session ───────────────────────────────────────

export interface NegotiationSession {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  supplierOrgId: string;
  supplierOrgName: string;
  buyerOrgId: string;
  buyerOrgName: string;
  state: NegotiationState;
  currentRound: number;
  maxRounds: number;
  correlationId: string;
  claims: string[]; // claim IDs
  proposals: SettlementProposal[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

// ─── Timeline Event (for UI) ──────────────────────────────────

export interface TimelineEvent {
  id: string;
  timestamp: string;
  actor: 'SUPPLIER_AGENT' | 'BUYER_AGENT' | 'POLICY_ENGINE' | 'PAYMENT_CONTROLLER' | 'SYSTEM';
  actorName: string;
  claimType: string;
  summary: string;
  evidenceSource: string;
  signatureVerified: boolean;
  supportingClaimIds: string[];
  stateTransition: {
    from: NegotiationState;
    to: NegotiationState;
  } | null;
  details: Record<string, unknown>;
  isMocked: boolean;
}
