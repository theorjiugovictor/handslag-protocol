/**
 * AuditService
 * 
 * Chronological, exportable audit log with correlation IDs.
 * Every significant action is recorded with actor, input claims,
 * policy decisions, state transitions, and payment results.
 */

import { v4 as uuidv4 } from 'uuid';

export type ActorType = 'SUPPLIER_AGENT' | 'BUYER_AGENT' | 'POLICY_ENGINE' | 'PAYMENT_CONTROLLER' | 'SYSTEM';

export interface AuditEntry {
  id: string;
  negotiationId: string;
  actor: string;
  actorType: ActorType;
  action: string;
  inputClaimRefs: string[];
  policyDecision: string | null;
  stateTransition: string | null;
  paymentResult: string | null;
  correlationId: string;
  timestamp: string;
  details: Record<string, unknown> | null;
}

// In-memory audit log (for demo; backed by Prisma in production)
let auditLog: AuditEntry[] = [];

/**
 * Record an audit event
 */
export function recordAuditEvent(params: {
  negotiationId: string;
  actor: string;
  actorType: ActorType;
  action: string;
  inputClaimRefs?: string[];
  policyDecision?: string;
  stateTransition?: string;
  paymentResult?: string;
  correlationId: string;
  details?: Record<string, unknown>;
}): AuditEntry {
  const entry: AuditEntry = {
    id: uuidv4(),
    negotiationId: params.negotiationId,
    actor: params.actor,
    actorType: params.actorType,
    action: params.action,
    inputClaimRefs: params.inputClaimRefs ?? [],
    policyDecision: params.policyDecision ?? null,
    stateTransition: params.stateTransition ?? null,
    paymentResult: params.paymentResult ?? null,
    correlationId: params.correlationId,
    timestamp: new Date().toISOString(),
    details: params.details ?? null,
  };
  auditLog.push(entry);
  return entry;
}

/**
 * Get all audit events for a negotiation
 */
export function getAuditLog(negotiationId?: string): AuditEntry[] {
  if (negotiationId) {
    return auditLog.filter(e => e.negotiationId === negotiationId);
  }
  return [...auditLog];
}

/**
 * Export audit log as JSON
 */
export function exportAuditJson(negotiationId?: string): string {
  const entries = getAuditLog(negotiationId);
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    totalEntries: entries.length,
    entries,
  }, null, 2);
}

/**
 * Clear all audit events (for demo reset)
 */
export function clearAuditLog(): void {
  auditLog = [];
}
