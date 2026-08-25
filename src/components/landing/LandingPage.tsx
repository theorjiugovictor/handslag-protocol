'use client';

import { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  Sparkles,
  Building2,
  CheckCircle2,
  FileCheck2,
  TrendingUp,
  Cpu,
  Coins,
  ShieldAlert,
} from 'lucide-react';
import { useSession } from '../auth/SessionProvider';

interface LandingPageProps {
  onEnterNetwork: () => void;
  onStartSoloDemo: () => void;
}

export default function LandingPage({ onEnterNetwork, onStartSoloDemo }: LandingPageProps) {
  const { session } = useSession();
  const [hoveredPillar, setHoveredPillar] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#fafaf9] text-slate-900 selection:bg-emerald-500 selection:text-white relative overflow-hidden gradient-mesh">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[480px] bg-gradient-to-b from-emerald-100/50 via-teal-50/20 to-transparent pointer-events-none -z-10 blur-3xl" />

      {/* Navigation Bar */}
      <header className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between border-b border-stone-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-50 rounded-b-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center text-white text-xl shadow-md ring-1 ring-stone-800">
            🤝
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight text-stone-900 font-sans">
                Handslag Protokoll
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                v2.4
              </span>
            </div>
            <span className="text-[11px] text-stone-500 font-medium block">
              Where balance sheets shake hands
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {session ? (
            <button
              onClick={onEnterNetwork}
              className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition-all shadow-sm cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Workspace ({session.companyCode})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <>
              <button
                onClick={onStartSoloDemo}
                className="text-xs font-semibold text-stone-600 hover:text-stone-900 px-3.5 py-2 rounded-lg hover:bg-stone-100/80 transition-colors cursor-pointer"
              >
                Simulation
              </button>
              <button
                onClick={onEnterNetwork}
                className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition-all shadow-sm hover:shadow-md cursor-pointer group"
              >
                <span>Enter Protokoll</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 text-emerald-400" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 pt-16 pb-24 text-center">
        {/* Top pill badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-stone-900/5 border border-stone-300 text-stone-800 text-xs font-semibold mb-8 backdrop-blur-sm shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="tracking-wide">Bilateral Financial Intelligence • Zero Trust Assumptions</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-7xl font-black text-stone-950 tracking-tight max-w-4xl mx-auto leading-[1.08] mb-6">
          Where enterprise balance sheets{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 via-teal-700 to-stone-900 underline decoration-emerald-400 decoration-wavy decoration-2">
            shake hands
          </span>.
        </h1>

        {/* Hero Tagline */}
        <p className="text-base sm:text-xl text-stone-600 max-w-2xl mx-auto leading-relaxed font-normal mb-10">
          The cryptographic protocol enabling autonomous corporate agents to verify obligations, dynamically reconcile working capital, and execute bank-grade settlements with mathematical certainty.
        </p>

        {/* Primary Handshake CTA Action */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button
            onClick={onEnterNetwork}
            className="w-full sm:w-auto px-9 py-4 bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 hover:from-stone-900 hover:to-stone-800 text-white rounded-2xl font-bold text-base shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4 cursor-pointer ring-4 ring-emerald-500/10 group"
          >
            <span className="text-3xl animate-float">🤝</span>
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-mono font-bold">
                Bilateral Network
              </div>
              <div className="text-sm font-extrabold text-white flex items-center gap-1.5">
                Make a Handslag
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 text-emerald-400" />
              </div>
            </div>
          </button>

          <button
            onClick={onStartSoloDemo}
            className="w-full sm:w-auto px-7 py-4 bg-white hover:bg-stone-50 text-stone-800 rounded-2xl font-bold text-sm border border-stone-300 hover:border-stone-400 shadow-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Interactive 1-Click Simulation</span>
          </button>
        </div>

        {/* Live Network Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto mb-20 text-left">
          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl border border-stone-200 shadow-xs">
            <span className="text-[11px] text-stone-500 font-medium block">Verification Framework</span>
            <span className="text-base font-bold text-stone-900 mt-0.5 block">Ed25519 Cryptography</span>
            <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">Bilateral Signed Envelopes</span>
          </div>

          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl border border-stone-200 shadow-xs">
            <span className="text-[11px] text-stone-500 font-medium block">Mandate Firewall</span>
            <span className="text-base font-bold text-stone-900 mt-0.5 block">12 Deterministic Rules</span>
            <span className="text-[10px] text-indigo-600 font-semibold block mt-0.5">0% LLM Money Authority</span>
          </div>

          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl border border-stone-200 shadow-xs">
            <span className="text-[11px] text-stone-500 font-medium block">Settlement Rail</span>
            <span className="text-base font-bold text-stone-900 mt-0.5 block">SEPA Instant / PSD2</span>
            <span className="text-[10px] text-sky-600 font-semibold block mt-0.5">Verification of Payee (VoP)</span>
          </div>

          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl border border-stone-200 shadow-xs">
            <span className="text-[11px] text-stone-500 font-medium block">Fraud Defense</span>
            <span className="text-base font-bold text-stone-900 mt-0.5 block">TransCare Shield</span>
            <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">150B SEK Double-Lien Block</span>
          </div>
        </div>

        {/* 4 Core Pillars */}
        <div className="text-left mb-16">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider font-mono">
              Protocol Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-950 mt-1 tracking-tight">
              Engineered for absolute trust in autonomous finance.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              onMouseEnter={() => setHoveredPillar(0)}
              onMouseLeave={() => setHoveredPillar(null)}
              className={`p-6 rounded-2xl border transition-all bg-white ${
                hoveredPillar === 0
                  ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/10'
                  : 'border-stone-200'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold mb-4">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-stone-900 mb-1">
                1. Verifiable Bilateral Claims
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Agents exchange verifiable claim envelopes signed with Ed25519 keypairs. Ledger evidence from Zwapgrid ERP systems is proven without exposing raw balances or private financial data.
              </p>
            </div>

            <div
              onMouseEnter={() => setHoveredPillar(1)}
              onMouseLeave={() => setHoveredPillar(null)}
              className={`p-6 rounded-2xl border transition-all bg-white ${
                hoveredPillar === 1
                  ? 'border-indigo-500 shadow-md ring-2 ring-indigo-500/10'
                  : 'border-stone-200'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-stone-900 mb-1">
                2. Deterministic Mandate Policy Firewall
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                LLMs never authorize or move money. Payments can only trigger after passing a 12-rule mathematical policy engine with hard spending limits, payee verification, and idempotency locks.
              </p>
            </div>

            <div
              onMouseEnter={() => setHoveredPillar(2)}
              onMouseLeave={() => setHoveredPillar(null)}
              className={`p-6 rounded-2xl border transition-all bg-white ${
                hoveredPillar === 2
                  ? 'border-sky-500 shadow-md ring-2 ring-sky-500/10'
                  : 'border-stone-200'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 font-bold mb-4">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-stone-900 mb-1">
                3. Dynamic Liquidity & Cash Calendar
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Replaces rigid 30-day default terms with sliding-scale multi-tranche settlements. Preserves operational cash reserves while providing early-settlement discounts for suppliers.
              </p>
            </div>

            <div
              onMouseEnter={() => setHoveredPillar(3)}
              onMouseLeave={() => setHoveredPillar(null)}
              className={`p-6 rounded-2xl border transition-all bg-white ${
                hoveredPillar === 3
                  ? 'border-amber-500 shadow-md ring-2 ring-amber-500/10'
                  : 'border-stone-200'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-bold mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-stone-900 mb-1">
                4. Receivable Double-Financing Shield
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Prevents the TransCare 150B SEK invoice fraud typology. Every active receivable is locked with a cryptographic SHA-512 commitment hash, preventing duplicate factoring across lenders.
              </p>
            </div>
          </div>
        </div>

        {/* Ready to Transact Banner */}
        <div className="bg-stone-900 text-white rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <h2 className="text-2xl sm:text-3xl font-black mb-3 tracking-tight">
            Ready to strike a Handslag?
          </h2>
          <p className="text-xs sm:text-sm text-stone-400 max-w-xl mx-auto mb-8">
            Log in as a supplier or buyer company, or open two windows simultaneously to conduct live real-time settlements against each other.
          </p>
          <button
            onClick={onEnterNetwork}
            className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold text-sm rounded-xl shadow-lg hover:shadow-emerald-500/20 transition-all inline-flex items-center gap-2.5 cursor-pointer"
          >
            <span>🤝 Select Company & Enter</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-8 border-t border-stone-200/80 text-center text-xs text-stone-400 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-stone-700">Handslag Protokoll</span>
          <span>•</span>
          <span>Where balance sheets shake hands</span>
        </div>
        <div className="text-[11px] text-stone-400 font-mono">
          PSD2 Open Payments • Zwapgrid ERP • Ed25519 Cryptography
        </div>
      </footer>
    </div>
  );
}
