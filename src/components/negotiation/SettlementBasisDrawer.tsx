'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Database, ShieldCheck, TrendingUp, Lock } from 'lucide-react';

interface SettlementBasisProps {
  amount: number;
  currency?: string;
  upfrontAmount?: number;
  deferredAmount?: number;
  invoiceNumber?: string;
  sourceSystem?: string;
  defaultExpanded?: boolean;
}

export default function SettlementBasisDrawer({
  amount = 10000,
  currency = 'EUR',
  upfrontAmount = 4000,
  deferredAmount = 6000,
  invoiceNumber = 'INV-2026-1042',
  sourceSystem = 'Zwapgrid ERP (Fortnox)',
  defaultExpanded = false,
}: SettlementBasisProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border border-zinc-200 bg-zinc-50/70 rounded-xl overflow-hidden font-mono text-xs transition-all">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-zinc-100/70 transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-800">
            SETTLEMENT BASIS
          </span>
          <span className="text-[9px] text-zinc-400 font-normal">
            Deterministic Treasury & Liquidity Audit
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-500 hover:text-black">
          <span className="text-[10px] uppercase font-semibold">{expanded ? 'Hide Audit' : 'Inspect Audit'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="p-4 pt-3 border-t border-zinc-200/80 bg-white space-y-3.5">
          {/* 3 Pillar Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <span className="text-[9px] text-zinc-400 uppercase tracking-widest block">01 / PSD2 CASH RUNWAY</span>
              <div className="text-xs font-semibold text-zinc-950 mt-1">€24,000 Balance</div>
              <div className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                €20,000 reserve locked for Day 25 payroll. Safe today: <strong className="text-zinc-900">€{upfrontAmount.toLocaleString()} {currency}</strong>.
              </div>
            </div>

            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <span className="text-[9px] text-zinc-400 uppercase tracking-widest block">02 / ERP INFLOW TIMING</span>
              <div className="text-xs font-semibold text-zinc-950 mt-1">Day 14 Customer Receipt</div>
              <div className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                Zwapgrid AR sync projects €12,500 inflow, clearing remaining <strong className="text-zinc-900">€{deferredAmount.toLocaleString()} {currency}</strong> tranche.
              </div>
            </div>

            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <span className="text-[9px] text-zinc-400 uppercase tracking-widest block">03 / POLICY & FRAUD SHIELD</span>
              <div className="text-xs font-semibold text-zinc-950 mt-1">12/12 Rules Validated</div>
              <div className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                TransCare SHA-512 lien recorded to block double-factoring. 0% LLM payment authority.
              </div>
            </div>
          </div>

          {/* Ledger Proof Metadata */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 text-[10px] text-zinc-500">
            <div className="flex items-center gap-3">
              <span>Source: <strong className="text-zinc-700">{sourceSystem}</strong></span>
              <span>•</span>
              <span>Invoice: <strong className="text-zinc-700">{invoiceNumber}</strong></span>
            </div>
            <div className="text-zinc-400">
              Deterministic Mandate Engine • Rule #9 & #12 Verified
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
