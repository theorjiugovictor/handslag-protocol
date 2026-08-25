'use client';

import { useState, useCallback, useEffect } from 'react';
import { useEventSource } from './useEventSource';

export interface NegotiationSummary {
  id: string;
  invoiceId: string;
  supplierOrg: string;
  buyerOrg: string;
  myRole: 'SUPPLIER' | 'BUYER';
  state: string;
  currentRound: number;
  claimCount: number;
  proposalCount: number;
  paymentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface NegotiationDetail {
  id: string;
  invoiceId: string;
  supplierOrg: { id: string; name: string; orgNumber: string };
  buyerOrg: { id: string; name: string; orgNumber: string };
  myRole: 'SUPPLIER' | 'BUYER';
  state: string;
  currentRound: number;
  correlationId: string;
  claims: Array<{
    id: string;
    claimType: string;
    issuerOrganization: string;
    subject: string;
    payload: Record<string, unknown>;
    sourceSystem: string;
    evidenceHash: string;
    verificationStatus: string;
    issuedAt: string;
    signature: string;
  }>;
  proposals: Array<{
    id: string;
    proposerRole: string;
    installments: Array<{ amount: number; currency: string; executionDate: string; label: string }>;
    totalAmount: number;
    currency: string;
    rationaleCode: string;
    status: string;
    sequenceNumber: number;
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    executionDate: string;
    isFutureDated: boolean;
    status: string;
    externalPaymentId: string | null;
    isMocked: boolean;
  }>;
  auditLog: Array<{
    id: string;
    actor: string;
    actorType: string;
    action: string;
    policyDecision: string | null;
    stateTransition: string | null;
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Hook for managing negotiation state with real-time updates
 */
export function useNegotiation(negotiationId: string | null) {
  const [negotiation, setNegotiation] = useState<NegotiationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { lastEvent } = useEventSource(!!negotiationId);

  const fetchNegotiation = useCallback(async () => {
    if (!negotiationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/negotiations/${negotiationId}/action`);
      const data = await res.json();
      if (data.success) {
        setNegotiation(data.negotiation);
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError('Failed to fetch negotiation');
    } finally {
      setLoading(false);
    }
  }, [negotiationId]);

  // Fetch on mount and when negotiationId changes
  useEffect(() => {
    fetchNegotiation();
  }, [fetchNegotiation]);

  // Refetch when SSE event arrives for this negotiation
  useEffect(() => {
    if (lastEvent && lastEvent.negotiationId === negotiationId) {
      fetchNegotiation();
    }
  }, [lastEvent, negotiationId, fetchNegotiation]);

  const performAction = useCallback(async (
    actionType: 'MATCH_PAYABLE' | 'PROPOSE' | 'COUNTER' | 'ACCEPT' | 'REJECT',
    payload?: Record<string, unknown>
  ) => {
    if (!negotiationId) return null;
    try {
      const res = await fetch(`/api/negotiations/${negotiationId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: actionType, payload }),
      });
      const data = await res.json();
      if (data.success) {
        // Immediately refetch to get updated state
        await fetchNegotiation();
      }
      return data;
    } catch (e) {
      return { success: false, error: 'Action failed' };
    }
  }, [negotiationId, fetchNegotiation]);

  return { negotiation, loading, error, refetch: fetchNegotiation, performAction };
}

/**
 * Hook for listing all negotiations
 */
export function useNegotiationList() {
  const [negotiations, setNegotiations] = useState<NegotiationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { lastEvent } = useEventSource(true);

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/negotiations');
      const data = await res.json();
      if (data.success) {
        setNegotiations(data.negotiations);
      }
    } catch (e) {
      console.error('Failed to fetch negotiations:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Refetch on any SSE event
  useEffect(() => {
    if (lastEvent) {
      fetchList();
    }
  }, [lastEvent, fetchList]);

  const createNegotiation = useCallback(async (params: {
    counterpartyCode: string;
    invoiceNumber: string;
    amount: number;
    currency?: string;
  }) => {
    try {
      const res = await fetch('/api/negotiations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.success) {
        await fetchList();
      }
      return data;
    } catch (e) {
      return { success: false, error: 'Create failed' };
    }
  }, [fetchList]);

  return { negotiations, loading, refetch: fetchList, createNegotiation };
}
