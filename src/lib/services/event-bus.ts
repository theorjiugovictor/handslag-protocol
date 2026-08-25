/**
 * EventBus
 * 
 * In-process event emitter that bridges API route writes → SSE reader streams.
 * Each connected client subscribes to events for their organization.
 * 
 * Events:
 * - negotiation:created   — New negotiation started
 * - negotiation:updated   — Negotiation state changed  
 * - claim:received        — New claim envelope arrived
 * - proposal:received     — New settlement proposal
 * - payment:executed      — Payment instruction executed
 * - session:updated       — Session/presence change
 */

import { EventEmitter } from 'events';

export interface SettlementEvent {
  type: 
    | 'negotiation:created'
    | 'negotiation:updated'
    | 'claim:received'
    | 'proposal:received'
    | 'payment:executed'
    | 'session:updated';
  negotiationId: string;
  targetOrgId: string;     // The org that should receive this event
  sourceOrgId: string;     // The org that triggered the event
  payload: Record<string, unknown>;
  timestamp: string;
}

// Global singleton to survive HMR
const globalForEventBus = globalThis as unknown as {
  settlementEventBus: EventEmitter | undefined;
};

function createEventBus(): EventEmitter {
  const bus = new EventEmitter();
  bus.setMaxListeners(100); // Support many concurrent SSE connections
  return bus;
}

export const eventBus =
  globalForEventBus.settlementEventBus ?? createEventBus();

if (process.env.NODE_ENV !== 'production') {
  globalForEventBus.settlementEventBus = eventBus;
}

/**
 * Emit an event to a specific organization's SSE stream
 */
export function emitSettlementEvent(event: Omit<SettlementEvent, 'timestamp'>): void {
  const fullEvent: SettlementEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  
  // Emit on org-specific channel
  eventBus.emit(`org:${event.targetOrgId}`, fullEvent);
  
  // Also emit on negotiation channel for debugging
  eventBus.emit(`negotiation:${event.negotiationId}`, fullEvent);
}

/**
 * Emit an event to ALL parties in a negotiation
 */
export function broadcastToNegotiation(
  negotiationId: string,
  orgIds: string[],
  type: SettlementEvent['type'],
  sourceOrgId: string,
  payload: Record<string, unknown>
): void {
  for (const orgId of orgIds) {
    emitSettlementEvent({
      type,
      negotiationId,
      targetOrgId: orgId,
      sourceOrgId,
      payload,
    });
  }
}
