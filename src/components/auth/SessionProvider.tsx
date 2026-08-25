'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

export interface SessionInfo {
  sessionToken: string;
  organizationId: string;
  organizationName: string;
  orgNumber: string;
  companyCode: string;
  role: string;
}

interface SessionContextValue {
  session: SessionInfo | null;
  loading: boolean;
  login: (companyCode: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  loading: true,
  login: async () => false,
  logout: async () => {},
});

export function useSession() {
  return useContext(SessionContext);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Check existing session on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth');
        const data = await res.json();
        if (data.success && data.authenticated) {
          setSession(data.session);
        }
      } catch (e) {
        console.error('Session check failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (companyCode: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyCode }),
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.session);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Login failed:', e);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
    } catch (e) {
      console.error('Logout failed:', e);
    }
    setSession(null);
  }, []);

  return (
    <SessionContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </SessionContext.Provider>
  );
}
