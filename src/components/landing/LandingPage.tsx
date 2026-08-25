'use client';

import { useState } from 'react';
import {
  ArrowRight,
  ShieldCheck,
  Building2,
  Lock,
  Terminal,
  Cpu,
  Layers,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import { useSession } from '../auth/SessionProvider';

interface LandingPageProps {
  onEnterNetwork: () => void;
  onStartSoloDemo: () => void;
}

export default function LandingPage({ onEnterNetwork, onStartSoloDemo }: LandingPageProps) {
  const { session } = useSession();

  return (
    <div className="min-h-screen bg-white text-zinc-950 selection:bg-black selection:text-white relative overflow-hidden font-sans antialiased bg-grid-light">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-8 h-20 flex items-center justify-between border-b border-zinc-200 bg-white/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shadow-xs">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 12L10 6L14 10L20 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 20L10 14L14 18L20 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <span className="font-bold text-xs tracking-[0.2em] text-zinc-950 font-mono block">
              HANDSLAG
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {session ? (
            <button
              onClick={onEnterNetwork}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white hover:bg-zinc-800 rounded-lg text-xs font-medium transition-all shadow-xs cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Workspace ({session.companyCode})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <>
              <button
                onClick={onStartSoloDemo}
                className="text-xs font-mono text-zinc-500 hover:text-black px-3.5 py-2 transition-colors cursor-pointer uppercase tracking-wider"
              >
                Simulation
              </button>
              <button
                onClick={onEnterNetwork}
                className="flex items-center gap-2 px-4 py-2 bg-black text-white hover:bg-zinc-800 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer group"
              >
                <span>Enter Network</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-8 pt-28 pb-32 text-center">
        {/* Sleek Tagline Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-800 text-[10px] font-mono tracking-[0.25em] uppercase mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse"></span>
          <span>Agentic Financial Handshake</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl font-light text-zinc-950 tracking-tight leading-[1.1] mb-6 max-w-2xl mx-auto">
          Where enterprise finances{' '}
          <span className="font-serif italic font-normal text-zinc-700">shake hands</span>.
        </h1>

        {/* Punchy Hero Subtitle */}
        <p className="text-base text-zinc-500 max-w-lg mx-auto leading-relaxed mb-12 font-normal">
          Autonomous agents reconcile working capital, verify bilateral obligations, and execute bank settlements in real time.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-24">
          <button
            onClick={onEnterNetwork}
            className="w-full sm:w-auto px-7 py-3.5 bg-black hover:bg-zinc-800 text-white rounded-xl font-semibold text-xs tracking-wider uppercase transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer group"
          >
            <span>Initiate Handslag</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>

          <button
            onClick={onStartSoloDemo}
            className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-zinc-50 text-zinc-700 hover:text-black rounded-xl font-mono text-xs border border-zinc-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            <Terminal className="w-3.5 h-3.5 text-zinc-400" />
            <span className="tracking-wide uppercase text-[11px]">Interactive Demo</span>
          </button>
        </div>

        {/* Metrics Matrix */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-200 border border-zinc-200 rounded-2xl overflow-hidden mb-24 text-left font-mono shadow-2xs">
          <div className="bg-white p-5">
            <span className="text-[9px] text-zinc-400 uppercase tracking-widest block">Cryptography</span>
            <span className="text-xs font-semibold text-zinc-950 mt-1.5 block">Ed25519 Envelopes</span>
            <span className="text-[10px] text-zinc-500 block mt-0.5">Signed Claim Proofs</span>
          </div>

          <div className="bg-white p-5">
            <span className="text-[9px] text-zinc-400 uppercase tracking-widest block">Mandate Firewall</span>
            <span className="text-xs font-semibold text-zinc-950 mt-1.5 block">12 Deterministic Rules</span>
            <span className="text-[10px] text-zinc-500 block mt-0.5">Zero LLM Money Authority</span>
          </div>

          <div className="bg-white p-5">
            <span className="text-[9px] text-zinc-400 uppercase tracking-widest block">Settlement Rail</span>
            <span className="text-xs font-semibold text-zinc-950 mt-1.5 block">PSD2 / SEPA Instant</span>
            <span className="text-[10px] text-zinc-500 block mt-0.5">Payee Verification</span>
          </div>

          <div className="bg-white p-5">
            <span className="text-[9px] text-zinc-400 uppercase tracking-widest block">Fraud Shield</span>
            <span className="text-xs font-semibold text-zinc-950 mt-1.5 block">TransCare Defense</span>
            <span className="text-[10px] text-zinc-500 block mt-0.5">SHA-512 Lien Registry</span>
          </div>
        </div>

        {/* 4 Concise Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left mb-20">
          <div className="p-6 rounded-2xl border border-zinc-200 bg-zinc-50/60">
            <div className="text-[9px] font-mono text-zinc-400 tracking-widest uppercase mb-2">01 / VERIFIABLE CLAIMS</div>
            <h3 className="text-xs font-bold text-zinc-950 mb-1.5">Cryptographic Ledger Proofs</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Ed25519 claim envelopes mathematically verify ERP receivables without exposing private balance sheets.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-zinc-200 bg-zinc-50/60">
            <div className="text-[9px] font-mono text-zinc-400 tracking-widest uppercase mb-2">02 / MANDATE FIREWALL</div>
            <h3 className="text-xs font-bold text-zinc-950 mb-1.5">Deterministic Safety Firewall</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              12 mathematical rules enforce spending caps, recipient checks, and reserve buffers before payment execution.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-zinc-200 bg-zinc-50/60">
            <div className="text-[9px] font-mono text-zinc-400 tracking-widest uppercase mb-2">03 / LIQUIDITY ENGINE</div>
            <h3 className="text-xs font-bold text-zinc-950 mb-1.5">Dynamic Multi-Tranche Cashflow</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Splits settlement into immediate upfront tranches and forward receivables, protecting operational reserves.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-zinc-200 bg-zinc-50/60">
            <div className="text-[9px] font-mono text-zinc-400 tracking-widest uppercase mb-2">04 / LIEN REGISTRY</div>
            <h3 className="text-xs font-bold text-zinc-950 mb-1.5">Double-Financing Shield</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Locks receivables with SHA-512 commitment hashes to prevent multi-lender invoice fraud.
            </p>
          </div>
        </div>

        {/* Action Card */}
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center">
          <h2 className="text-lg font-light text-zinc-950 mb-1.5 tracking-tight">
            Ready to initiate a Handslag?
          </h2>
          <p className="text-xs text-zinc-500 mb-6">
            Select an enterprise identity to conduct autonomous real-time settlements.
          </p>
          <button
            onClick={onEnterNetwork}
            className="px-6 py-3 bg-black text-white hover:bg-zinc-800 font-semibold text-xs tracking-wider uppercase rounded-lg transition-all shadow-xs inline-flex items-center gap-2 cursor-pointer"
          >
            <span>Enter Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="max-w-6xl mx-auto px-8 py-8 border-t border-zinc-200 text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
        <div className="flex items-center gap-2">
          <span className="text-zinc-900 font-semibold">HANDSLAG</span>
          <span>/</span>
          <span>AGENTIC FINANCIAL HANDSHAKE</span>
        </div>
        <div className="text-[10px] tracking-widest uppercase text-zinc-400">
          PSD2 • ZWAPGRID • ED25519
        </div>
      </footer>
    </div>
  );
}
