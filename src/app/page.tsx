'use client';

import { useState, useEffect } from 'react';
import { SessionProvider, useSession } from '@/components/auth/SessionProvider';
import LandingPage from '@/components/landing/LandingPage';
import LoginScreen from '@/components/auth/LoginScreen';
import NegotiationInbox from '@/components/negotiation/NegotiationInbox';
import LiveNegotiationView from '@/components/negotiation/LiveNegotiationView';
import SoloDemoView from '@/components/demo/SoloDemoView';

type AppView = 
  | { type: 'landing' }
  | { type: 'login' }
  | { type: 'inbox' }
  | { type: 'negotiation'; id: string }
  | { type: 'solo-demo' };

function AppContent() {
  const { session, loading } = useSession();
  const [view, setView] = useState<AppView>({ type: 'landing' });

  // If a session becomes active and we are on the login view, automatically move to inbox
  useEffect(() => {
    if (session && view.type === 'login') {
      setView({ type: 'inbox' });
    }
  }, [session, view.type]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center animate-pulse shadow-xs">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 12L10 6L14 10L20 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 20L10 14L14 18L20 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-xs text-zinc-400 font-mono tracking-widest uppercase">Loading Handslag...</p>
        </div>
      </div>
    );
  }

  // 1. Landing Page ALWAYS renders first
  if (view.type === 'landing') {
    return (
      <LandingPage
        onEnterNetwork={() => setView(session ? { type: 'inbox' } : { type: 'login' })}
        onStartSoloDemo={() => setView({ type: 'solo-demo' })}
      />
    );
  }

  // 2. Solo Simulation
  if (view.type === 'solo-demo') {
    return <SoloDemoView onBack={() => setView({ type: 'landing' })} />;
  }

  // 3. Login / Enterprise Selection
  if (view.type === 'login' && !session) {
    return (
      <LoginScreen
        onBackToLanding={() => setView({ type: 'landing' })}
        onLoginSuccess={() => setView({ type: 'inbox' })}
      />
    );
  }

  // 4. Authenticated views guard
  if (!session) {
    return (
      <LoginScreen
        onBackToLanding={() => setView({ type: 'landing' })}
        onLoginSuccess={() => setView({ type: 'inbox' })}
      />
    );
  }

  // 5. Active Negotiation View
  if (view.type === 'negotiation') {
    return (
      <LiveNegotiationView
        negotiationId={view.id}
        onBack={() => setView({ type: 'inbox' })}
      />
    );
  }

  // 6. Default Authenticated View: Negotiation Inbox
  return (
    <NegotiationInbox
      onSelectNegotiation={(id) => setView({ type: 'negotiation', id })}
      onStartSoloDemo={() => setView({ type: 'solo-demo' })}
    />
  );
}

export default function Home() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  );
}
