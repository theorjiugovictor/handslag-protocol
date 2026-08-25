'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { SettlementEvent } from '@/lib/services/event-bus';

/**
 * Hook for subscribing to Server-Sent Events from the settlement network.
 * Automatically reconnects on disconnection.
 */
export function useEventSource(enabled: boolean = true) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SettlementEvent | null>(null);
  const [events, setEvents] = useState<SettlementEvent[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;
    
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/events');
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data);
        
        if (raw.type === 'connected') {
          // Initial connection event, not a settlement event
          return;
        }

        const data = raw as SettlementEvent;
        setLastEvent(data);
        setEvents((prev) => [...prev, data]);
      } catch (e) {
        console.error('[SSE] Failed to parse event:', e);
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };
  }, [enabled]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setLastEvent(null);
  }, []);

  return { connected, lastEvent, events, clearEvents };
}
