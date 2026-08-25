'use client';

import { useState } from 'react';
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-stone-900 flex items-center justify-center text-white text-2xl animate-pulse shadow-md">
            🤝
          </div>
          <p className="text-xs text-stone-500 font-medium tracking-wide">Loading Handslag Protokoll...</p>
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
  if (view.type === 'login') {
    return (
      <LoginScreen
        onBackToLanding={() => setView({ type: 'landing' })}
      />
    );
  }

  // 4. Authenticated views guard
  if (!session) {
    return <LoginScreen onBackToLanding={() => setView({ type: 'landing' })} />;
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

  // 6. Default: Authenticated Inbox
  return (
    <NegotiationInbox
      onSelectNegotiation={(id) => setView({ type: 'negotiation', id })}
      onStartSoloDemo={() => setView({ type: 'solo-demo' })}
    />
  );
}

export default function HandslagApp() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  );
}
