'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  ShieldAlert,
  Download,
  Lock,
  Clock,
  Building2,
  CheckCircle2,
  XCircle,
  Eye,
  Activity,
  Network,
  LayoutDashboard,
  ArrowRight,
  ArrowLeft,
  Cpu,
  Server,
  Key,
  ShieldCheck,
  Send,
  Zap,
  SlidersHorizontal,
  Sparkles,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  BarChart3,
  Database,
  AlertTriangle,
  Layers,
  FileSpreadsheet,
  Check,
  X,
  CreditCard,
  CalendarCheck,
} from 'lucide-react';
import { TreasuryIntelligenceService } from '@/lib/services/treasury-intelligence';

// ─── Types ───────────────────────────────────────────────────────

interface TimelineEvent {
  id: string;
  timestamp: string;
  actor: 'SUPPLIER_AGENT' | 'BUYER_AGENT' | 'POLICY_ENGINE' | 'PAYMENT_CONTROLLER' | 'SYSTEM';
  actorName: string;
  claimType: string;
  summary: string;
  evidenceSource: string;
  signatureVerified: boolean;
  supportingClaimIds: string[];
  stateTransition: { from: string; to: string } | null;
  details: Record<string, unknown>;
  isMocked: boolean;
}

interface PolicyCheck {
  checkName: string;
  description: string;
  result: 'PASS' | 'FAIL';
  actual: string;
  limit: string;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  executionDate: string;
  isFutureDated: boolean;
  status: string;
  externalPaymentId: string | null;
  idempotencyKey: string;
  isMocked: boolean;
  policyEvaluation: {
    checks: PolicyCheck[];
    overallResult: string;
  } | null;
}

interface MandateInfo {
  mandateId: string;
  mandateVersion: number;
  principal: { organizationId: string; organizationName: string };
  maxAmountPerPayment: number;
  maxCumulativeAmount: number;
  maxDailyAmount: number;
  allowedCurrencies: string[];
  approvedCounterpartyIds: string[];
  approvedDestination: string;
  earliestExecDate: string;
  latestExecDate: string;
  futureDatedAllowed: boolean;
  expiresAt: string;
  revoked: boolean;
  signatureMetadata: { type: string; signedBy: string };
}

interface AuditEntry {
  id: string;
  actor: string;
  actorType: string;
  action: string;
  inputClaimRefs: string[];
  policyDecision: string | null;
  stateTransition: string | null;
  paymentResult: string | null;
  correlationId: string;
  timestamp: string;
}

interface ClaimItem {
  claimId: string;
  claimType: string;
  issuerOrganization: string;
  payload: Record<string, unknown>;
  sourceSystem: string;
  verificationStatus: string;
  evidenceHash: string;
  issuedAt: string;
  signature: string;
}

interface DemoState {
  negotiationId: string;
  correlationId: string;
  state: string;
  claims: ClaimItem[];
  timeline: TimelineEvent[];
  payments: Payment[];
  mandate: MandateInfo;
  mandateUsage: { totalSpent: number; dailySpent: number; paymentCount: number };
  currentStep: number;
  totalSteps: number;
  isComplete: boolean;
  scenario: string;
  auditLog: AuditEntry[];
}

// ─── Process Pipeline Stages ────────────────────────────────────

const PROTOCOL_STAGES = [
  { id: 'OBLIGATION', label: '1. Obligation Verification', minStep: 1 },
  { id: 'PROPOSAL', label: '2. Terms Proposal', minStep: 4 },
  { id: 'LIQUIDITY', label: '3. Liquidity Evaluation', minStep: 5 },
  { id: 'CONSENSUS', label: '4. Agreement Reached', minStep: 7 },
  { id: 'POLICY', label: '5. Policy Validation', minStep: 8 },
  { id: 'SETTLEMENT', label: '6. PSD2 Payment Execution', minStep: 9 },
];

export default function SoloDemoView({ onBack }: { onBack?: () => void }) {
  const [demoState, setDemoState] = useState<DemoState | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'dashboard' | 'distributed'>('dashboard');
  const [activeTab, setActiveTab] = useState<'stream' | 'mandate' | 'audit' | 'optimizer' | 'treasury'>('stream');
  const [selectedClaim, setSelectedClaim] = useState<ClaimItem | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [acceleratedMode, setAcceleratedMode] = useState(false);

  // Dynamic Agent Mandate Playground State
  const [invoiceAmount, setInvoiceAmount] = useState<number>(10000);
  const [buyerBankBalance, setBuyerBankBalance] = useState<number>(24000);
  const [buyerReserve, setBuyerReserve] = useState<number>(20000);
  const [buyerMandateCeiling, setBuyerMandateCeiling] = useState<number>(6000);
  const [supplierMinUpfront, setSupplierMinUpfront] = useState<number>(2500);
  const [showConfigDrawer, setShowConfigDrawer] = useState<boolean>(false);

  // Real-time Flow Playback State
  const [isPlayingFlow, setIsPlayingFlow] = useState(false);
  const [flowSpeed, setFlowSpeed] = useState<number>(2600); // 2.6 seconds default
  const flowTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(false);
  isPlayingRef.current = isPlayingFlow;

  const getConfigPayload = useCallback(() => ({
    invoiceAmount,
    currency: 'EUR',
    buyerBankBalance,
    buyerOperationalReserve: buyerReserve,
    buyerMandateCeiling,
    supplierMinUpfront,
    supplierMaxWaitDays: 14,
  }), [invoiceAmount, buyerBankBalance, buyerReserve, buyerMandateCeiling, supplierMinUpfront]);

  const stepApi = useCallback(async () => {
    try {
      const res = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'step', config: getConfigPayload() }),
      });
      const data = await res.json();
      if (data.success && data.state) {
        setDemoState(data.state);
        return data.state;
      }
    } catch (e) {
      console.error('Step API call failed:', e);
    }
    return null;
  }, [getConfigPayload]);

  const resetApi = useCallback(async () => {
    setIsPlayingFlow(false);
    if (flowTimerRef.current) clearTimeout(flowTimerRef.current);
    setLoading(true);
    try {
      await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      setDemoState(null);
    } catch (e) {
      console.error('Reset failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        stepApi();
      } else if (e.key.toLowerCase() === 'r') {
        resetApi();
      } else if (e.key.toLowerCase() === 'v') {
        setViewMode((prev) => (prev === 'dashboard' ? 'distributed' : 'dashboard'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stepApi, resetApi]);

  const runRejectionApi = useCallback(async () => {
    setIsPlayingFlow(false);
    if (flowTimerRef.current) clearTimeout(flowTimerRef.current);
    setLoading(true);
    try {
      const res = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run-rejection', config: getConfigPayload() }),
      });
      const data = await res.json();
      if (data.success) {
        setDemoState(data.state);
      }
    } catch (e) {
      console.error('Rejection run failed:', e);
    } finally {
      setLoading(false);
    }
  }, [getConfigPayload]);

  // Real-time flow execution loop
  const startRealtimeFlow = useCallback(async () => {
    if (isPlayingRef.current) {
      setIsPlayingFlow(false);
      if (flowTimerRef.current) clearTimeout(flowTimerRef.current);
      return;
    }

    setIsPlayingFlow(true);
    let state = demoState;

    if (!state || state.isComplete) {
      await resetApi();
      state = await stepApi();
    }

    const runNext = async () => {
      if (!isPlayingRef.current) return;
      const nextState = await stepApi();
      if (nextState && !nextState.isComplete) {
        flowTimerRef.current = setTimeout(runNext, flowSpeed);
      } else {
        setIsPlayingFlow(false);
      }
    };

    flowTimerRef.current = setTimeout(runNext, flowSpeed);
  }, [demoState, flowSpeed, resetApi, stepApi]);

  useEffect(() => {
    return () => {
      if (flowTimerRef.current) clearTimeout(flowTimerRef.current);
    };
  }, []);

  const exportAudit = useCallback(async () => {
    if (!demoState) return;
    const res = await fetch(`/api/audit?negotiationId=${demoState.negotiationId}&format=json`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `settlement-audit-${demoState.negotiationId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [demoState]);

  const currentStep = demoState?.currentStep ?? 0;
  const latestEvent = demoState?.timeline?.[demoState.timeline.length - 1];

  return (
    <div className="min-h-screen bg-white text-zinc-950 selection:bg-black selection:text-white font-sans antialiased pb-20 bg-grid-light">
      {/* Top Header */}
      <header className="bg-white/90 border-b border-zinc-200 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-lg text-zinc-500 hover:text-black hover:bg-zinc-100 transition-colors cursor-pointer border border-zinc-200"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shadow-xs">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 12L10 6L14 10L20 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 20L10 14L14 18L20 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <span className="font-bold text-zinc-950 text-xs font-mono tracking-[0.2em] uppercase">HANDSLAG</span>
                <span className="ml-2.5 text-[9px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 uppercase">
                  Solo Simulation
                </span>
                <span className="ml-2 text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  SANDBOX
                </span>
              </div>
            </div>

            {/* View Mode Toggle: Dashboard vs Distributed System */}
            <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 text-xs font-mono">
              <button
                onClick={() => setViewMode('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'dashboard'
                    ? 'bg-white text-zinc-950 font-bold shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-950'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => setViewMode('distributed')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'distributed'
                    ? 'bg-white text-zinc-950 font-bold shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-950'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>Network Flow</span>
              </button>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowConfigDrawer((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold border transition-all cursor-pointer ${
                showConfigDrawer
                  ? 'bg-zinc-950 text-white border-black shadow-xs'
                  : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 shadow-2xs'
              }`}
              title="Configure custom invoice and agent mandate parameters"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Parameters</span>
              {showConfigDrawer ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
            </button>

            <button
              onClick={startRealtimeFlow}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer shadow-xs ${
                isPlayingFlow
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-black hover:bg-zinc-800 text-white'
              }`}
            >
              {isPlayingFlow ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{demoState && !demoState.isComplete ? 'Resume' : 'Live Settlement'}</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setIsPlayingFlow(false);
                if (flowTimerRef.current) clearTimeout(flowTimerRef.current);
                stepApi();
              }}
              disabled={loading || isPlayingFlow || (demoState?.isComplete ?? false)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-mono font-semibold bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
            >
              <StepForward className="w-3.5 h-3.5" />
              <span>Step</span>
            </button>

            {/* Speed Selector */}
            <div className="hidden sm:flex items-center gap-1 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 text-[11px] font-mono">
              <button
                onClick={() => setFlowSpeed(3600)}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  flowSpeed === 3600 ? 'bg-white text-zinc-950 shadow-xs font-bold' : 'text-zinc-500 hover:text-zinc-950'
                }`}
                title="0.5x speed"
              >
                0.5x
              </button>
              <button
                onClick={() => setFlowSpeed(2600)}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  flowSpeed === 2600 ? 'bg-white text-zinc-950 shadow-xs font-bold' : 'text-zinc-500 hover:text-zinc-950'
                }`}
                title="1x standard speed"
              >
                1x
              </button>
              <button
                onClick={() => setFlowSpeed(1500)}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  flowSpeed === 1500 ? 'bg-white text-zinc-950 shadow-xs font-bold' : 'text-zinc-500 hover:text-zinc-950'
                }`}
                title="1.5x fast speed"
              >
                1.5x
              </button>
            </div>

            <button
              onClick={runRejectionApi}
              disabled={loading || isPlayingFlow}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Test Violation</span>
            </button>

            <button
              onClick={resetApi}
              disabled={loading}
              className="p-2 rounded-lg text-zinc-500 hover:text-black hover:bg-zinc-100 border border-zinc-200 transition-colors cursor-pointer shadow-2xs"
              title="Reset Simulation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Parameter Configuration Drawer */}
      {showConfigDrawer && (
        <div className="bg-zinc-50 border-b border-zinc-200 p-6 animate-fadeIn">
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-zinc-950 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-zinc-700" />
                  Agent Mandate & Treasury Simulation Parameters
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Adjust balance sheet numbers in real time to simulate working capital squeezes and mandate thresholds.
                </p>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <button
                  onClick={() => {
                    setInvoiceAmount(10000);
                    setBuyerBankBalance(24000);
                    setBuyerReserve(20000);
                    setBuyerMandateCeiling(6000);
                    setSupplierMinUpfront(2500);
                    resetApi();
                  }}
                  className="text-[10px] px-3 py-1 rounded bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200 transition-colors cursor-pointer uppercase shadow-2xs"
                >
                  Standard (€10k)
                </button>
                <button
                  onClick={() => {
                    setInvoiceAmount(25000);
                    setBuyerBankBalance(35000);
                    setBuyerReserve(25000);
                    setBuyerMandateCeiling(10000);
                    setSupplierMinUpfront(8000);
                    resetApi();
                  }}
                  className="text-[10px] px-3 py-1 rounded bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200 transition-colors cursor-pointer uppercase shadow-2xs"
                >
                  High-Value (€25k)
                </button>
                <button
                  onClick={() => {
                    setInvoiceAmount(15000);
                    setBuyerBankBalance(22500);
                    setBuyerReserve(20000);
                    setBuyerMandateCeiling(5000);
                    setSupplierMinUpfront(2500);
                    resetApi();
                  }}
                  className="text-[10px] px-3 py-1 rounded bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200 transition-colors cursor-pointer uppercase shadow-2xs"
                >
                  Liquidity Squeeze (€15k)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
              <div className="bg-white p-3 rounded-lg border border-zinc-200 shadow-2xs">
                <label className="text-[10px] text-zinc-500 uppercase block mb-1">Invoice Amount (€)</label>
                <input
                  type="number"
                  value={invoiceAmount}
                  onChange={(e) => {
                    setInvoiceAmount(Number(e.target.value));
                    resetApi();
                  }}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded px-2.5 py-1 text-zinc-950 font-mono font-bold text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div className="bg-white p-3 rounded-lg border border-zinc-200 shadow-2xs">
                <label className="text-[10px] text-zinc-500 uppercase block mb-1">Buyer Bank Balance (€)</label>
                <input
                  type="number"
                  value={buyerBankBalance}
                  onChange={(e) => {
                    setBuyerBankBalance(Number(e.target.value));
                    resetApi();
                  }}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded px-2.5 py-1 text-zinc-950 font-mono font-bold text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div className="bg-white p-3 rounded-lg border border-zinc-200 shadow-2xs">
                <label className="text-[10px] text-zinc-500 uppercase block mb-1">Operational Reserve (€)</label>
                <input
                  type="number"
                  value={buyerReserve}
                  onChange={(e) => {
                    setBuyerReserve(Number(e.target.value));
                    resetApi();
                  }}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded px-2.5 py-1 text-zinc-950 font-mono font-bold text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div className="bg-white p-3 rounded-lg border border-zinc-200 shadow-2xs">
                <label className="text-[10px] text-zinc-500 uppercase block mb-1">Mandate Cap / Payment (€)</label>
                <input
                  type="number"
                  value={buyerMandateCeiling}
                  onChange={(e) => {
                    setBuyerMandateCeiling(Number(e.target.value));
                    resetApi();
                  }}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded px-2.5 py-1 text-zinc-950 font-mono font-bold text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div className="bg-white p-3 rounded-lg border border-zinc-200 shadow-2xs">
                <label className="text-[10px] text-zinc-500 uppercase block mb-1">Supplier Min Upfront (€)</label>
                <input
                  type="number"
                  value={supplierMinUpfront}
                  onChange={(e) => {
                    setSupplierMinUpfront(Number(e.target.value));
                    resetApi();
                  }}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded px-2.5 py-1 text-zinc-950 font-mono font-bold text-sm focus:outline-none focus:border-black"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 pt-8">
        {/* Step-by-Step Progress Pipeline */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 mb-8 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-500 mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="uppercase tracking-widest text-[10px]">Protocol State Machine</span>
              {isPlayingFlow && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-pulse">
                  <Activity className="w-3 h-3" />
                  Live Flow Active
                </span>
              )}
            </div>
            <span className="font-bold text-zinc-950 text-[11px]">
              {demoState?.state ? demoState.state.replace(/_/g, ' ') : 'STANDBY'}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 font-mono">
            {PROTOCOL_STAGES.map((stage) => {
              const isPassed = currentStep >= stage.minStep;
              const isCurrent = currentStep === stage.minStep || (stage.minStep === 9 && currentStep >= 9);
              return (
                <div
                  key={stage.id}
                  className={`p-2.5 rounded-lg border text-center transition-all text-xs ${
                    isPassed
                      ? 'bg-black border-black text-white'
                      : isCurrent
                      ? 'bg-zinc-100 border-zinc-400 text-zinc-950 font-bold'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-400'
                  }`}
                >
                  <div className="text-[10px] truncate uppercase tracking-wider">{stage.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── VIEW 1: DISTRIBUTED SYSTEM FLOW ─────────────────── */}
        {viewMode === 'distributed' && (
          <div className="space-y-6">
            {/* Distributed Topology Canvas */}
            <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-2xs">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-100">
                <div>
                  <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2 font-mono">
                    <Network className="w-4 h-4 text-zinc-700" />
                    Distributed Principal Architecture & Cryptographic Message Wire
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Isolated runtime nodes exchanging cryptographically signed claim envelopes over an untrusted transport wire.
                  </p>
                </div>
                <div className="text-right font-mono text-xs text-zinc-500">
                  <span>Transport: </span>
                  <span className="text-zinc-950 font-bold">TLS + Ed25519 Payload Signing</span>
                </div>
              </div>

              {/* Visual Distributed Nodes & Interactive Transit Wire */}
              <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-center">
                {/* Node Alpha: Supplier Realm (4 cols) */}
                <div className="lg:col-span-4 bg-zinc-50 rounded-xl border border-zinc-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-zinc-700" />
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 font-mono">Node Alpha: Supplier VPC</span>
                    </div>
                    <span className="text-[10px] font-mono bg-white text-zinc-700 border border-zinc-200 px-2 py-0.5 rounded">
                      Identity A
                    </span>
                  </div>

                  <div className="text-sm font-bold text-zinc-950">Nordic Components AB</div>
                  <div className="text-xs text-zinc-500 font-mono mt-0.5">Agent: SupplierSettlementDaemon v1</div>

                  <div className="mt-4 pt-3 border-t border-zinc-200 space-y-2 text-xs font-mono">
                    <div className="flex justify-between items-center text-zinc-600">
                      <span>Zwapgrid AR Consent:</span>
                      <span className="text-emerald-700 font-semibold">CONNECTED</span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-600">
                      <span>Private Key Storage:</span>
                      <span className="text-zinc-950 font-semibold">Local Enclave</span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-600">
                      <span>Cross-Ledger Access:</span>
                      <span className="text-rose-600 font-semibold">BLOCKED (0-Trust)</span>
                    </div>
                  </div>
                </div>

                {/* Central Transit Bus & In-Flight Packet (3 cols) */}
                <div className="lg:col-span-3 flex flex-col items-center justify-center p-3 text-center">
                  <div className="w-full flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-2 px-2">
                    <span>Alpha</span>
                    <span className="text-zinc-900 font-bold uppercase tracking-widest text-[9px]">Transit Wire</span>
                    <span>Beta</span>
                  </div>

                  {/* Wire line with in-flight packet */}
                  <div className="w-full h-1 bg-zinc-200 rounded-full relative my-3">
                    {latestEvent && (
                      <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-mono px-3 py-1 rounded-full shadow-md flex items-center gap-1.5 whitespace-nowrap animate-pulse">
                        <Lock className="w-3 h-3 text-emerald-400" />
                        <span>{latestEvent.claimType}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-zinc-500 font-mono mt-1">
                    {latestEvent?.actor === 'SUPPLIER_AGENT' && (
                      <span className="flex items-center gap-1 text-zinc-950 font-semibold">
                        <span>Alpha → Beta</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    )}
                    {latestEvent?.actor === 'BUYER_AGENT' && (
                      <span className="flex items-center gap-1 text-zinc-950 font-semibold">
                        <ArrowLeft className="w-3 h-3" />
                        <span>Beta → Alpha</span>
                      </span>
                    )}
                    {!latestEvent && <span>Awaiting transmission...</span>}
                  </div>
                </div>

                {/* Node Beta: Buyer Realm (4 cols) */}
                <div className="lg:col-span-4 bg-zinc-50 rounded-xl border border-zinc-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-zinc-700" />
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 font-mono">Node Beta: Buyer VPC</span>
                    </div>
                    <span className="text-[10px] font-mono bg-white text-zinc-700 border border-zinc-200 px-2 py-0.5 rounded">
                      Identity B
                    </span>
                  </div>

                  <div className="text-sm font-bold text-zinc-950">Aurora Retail AB</div>
                  <div className="text-xs text-zinc-500 font-mono mt-0.5">Agent: BuyerSettlementDaemon v1</div>

                  <div className="mt-4 pt-3 border-t border-zinc-200 space-y-2 text-xs font-mono">
                    <div className="flex justify-between items-center text-zinc-600">
                      <span>Open Payments PSD2:</span>
                      <span className="text-emerald-700 font-semibold">CONNECTED</span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-600">
                      <span>Zwapgrid AP Consent:</span>
                      <span className="text-emerald-700 font-semibold">CONNECTED</span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-600">
                      <span>Raw Balance Leakage:</span>
                      <span className="text-emerald-700 font-semibold">PREVENTED</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Central Mathematical Policy Firewall & Payment Rail */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gatekeeper Firewall */}
              <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-2xs font-mono">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-zinc-800" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-950">
                      Deterministic Safety Firewall (No LLM Authority)
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono bg-zinc-100 text-zinc-800 border border-zinc-200 px-2 py-0.5 rounded">
                    12 Active Rules
                  </span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed mb-4">
                  Every proposed settlement term must pass deterministic mathematical constraints before the Payment Controller touches the banking layer.
                </p>

                <div className="space-y-2">
                  {demoState?.payments
                    ?.flatMap((p) => p.policyEvaluation?.checks ?? [])
                    .slice(0, 5)
                    .map((c, i) => (
                      <div key={i} className="flex justify-between items-center p-2.5 rounded bg-zinc-50 border border-zinc-200 text-xs">
                        <span className="text-zinc-800">{c.checkName}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          c.result === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {c.result}
                        </span>
                      </div>
                    ))}
                  {(!demoState?.payments || demoState.payments.length === 0) && (
                    <p className="text-xs text-zinc-400 py-3 text-center">
                      Firewall standing by for consensus proposal...
                    </p>
                  )}
                </div>
              </div>

              {/* Message Wire Inspector */}
              <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-2xs font-mono">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-zinc-700" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-950">
                      Message Wire Inspector ({demoState?.claims?.length ?? 0} Envelopes)
                    </h4>
                  </div>
                  <span className="text-[10px] text-zinc-400">JSON-RPC / Ed25519</span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {demoState?.claims?.map((c) => (
                    <div
                      key={c.claimId}
                      onClick={() => setSelectedClaim(c)}
                      className="p-2.5 rounded-lg border border-zinc-200 hover:border-zinc-400 bg-zinc-50 cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-zinc-950">{c.claimType}</span>
                        <span className="text-[10px] text-emerald-700 font-semibold">✓ {c.verificationStatus}</span>
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate">
                        Issuer: {c.issuerOrganization} • Hash: {c.evidenceHash.slice(0, 16)}...
                      </div>
                    </div>
                  ))}
                  {(!demoState?.claims || demoState.claims.length === 0) && (
                    <p className="text-xs text-zinc-400 py-6 text-center">
                      No message packets in transit yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── VIEW 2: STANDARD DASHBOARD VIEW ────────────────── */}
        {viewMode === 'dashboard' && (
          <>
            {/* Invoice Summary Banner */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 font-mono">
              <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-2xs">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Overdue Invoice</span>
                <div className="text-lg font-bold text-zinc-950 mt-1">INV-2026-1042</div>
                <div className="text-xs text-rose-700 font-medium mt-1">22 days overdue</div>
              </div>
              <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-2xs">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Obligation Amount</span>
                <div className="text-lg font-bold text-zinc-950 mt-1">€10,000.00 EUR</div>
                <div className="text-xs text-zinc-500 mt-1">Due Aug 2, 2026</div>
              </div>
              <div
                onClick={() => demoState?.payments?.[0] && setSelectedPayment(demoState.payments[0])}
                className={`bg-white rounded-xl border p-5 shadow-2xs transition-all ${
                  demoState?.payments?.[0] ? 'cursor-pointer hover:border-emerald-500 hover:shadow-sm border-emerald-300' : 'border-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Immediate Tranche</span>
                  {demoState?.payments?.[0] && (
                    <span className="text-[9px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-bold">
                      View SEPA ➔
                    </span>
                  )}
                </div>
                <div className="text-lg font-bold text-emerald-700 mt-1">
                  {demoState?.payments?.[0] ? '€4,000.00' : '—'}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {demoState?.payments?.[0] ? 'SEPA Instant via PSD2' : 'Pending negotiation'}
                </div>
              </div>
              <div
                onClick={() => demoState?.payments?.[1] && setSelectedPayment(demoState.payments[1])}
                className={`bg-white rounded-xl border p-5 shadow-2xs transition-all ${
                  demoState?.payments?.[1] ? 'cursor-pointer hover:border-zinc-500 hover:shadow-sm border-zinc-300' : 'border-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Scheduled Tranche</span>
                  {demoState?.payments?.[1] && (
                    <span className="text-[9px] text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 font-bold">
                      View Advice ➔
                    </span>
                  )}
                </div>
                <div className="text-lg font-bold text-zinc-950 mt-1">
                  {demoState?.payments?.[1] ? '€6,000.00' : '—'}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {demoState?.payments?.[1] ? 'Scheduled for the 14th' : 'Pending negotiation'}
                </div>
              </div>
            </div>

            {/* 2-Column Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Autonomous Agents & Data Minimization (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                {/* Supplier Card */}
                <div className={`bg-white rounded-xl border p-5 shadow-2xs transition-all ${
                  currentStep === 1 || currentStep === 4 || currentStep === 7
                    ? 'border-black ring-2 ring-zinc-900/10'
                    : 'border-zinc-200'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-zinc-700" />
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-950 font-mono">Supplier Principal</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                      Ed25519 Key A
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-zinc-950">Nordic Components AB</h3>
                  <p className="text-xs text-zinc-500 mt-0.5 font-mono">Org: 556789-0123 • Sweden</p>
                  <div className="mt-4 pt-3 border-t border-zinc-100 text-xs text-zinc-600 flex justify-between font-mono">
                    <span>Policy Mandate:</span>
                    <span className="font-semibold text-zinc-950">≥ €2,500 immediate, rest ≤ 14d</span>
                  </div>
                </div>

                {/* Buyer Card */}
                <div className={`bg-white rounded-xl border p-5 shadow-2xs transition-all ${
                  currentStep === 2 || currentStep === 5 || currentStep === 6
                    ? 'border-black ring-2 ring-zinc-900/10'
                    : 'border-zinc-200'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-zinc-700" />
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-950 font-mono">Buyer Principal</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                      Ed25519 Key B
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-zinc-950">Aurora Retail AB</h3>
                  <p className="text-xs text-zinc-500 mt-0.5 font-mono">Org: 559123-4568 • Sweden</p>
                  <div className="mt-4 pt-3 border-t border-zinc-100 text-xs text-zinc-600 flex justify-between font-mono">
                    <span>Policy Constraint:</span>
                    <span className="font-semibold text-zinc-950">Preserve €20k liquidity, max €4k today</span>
                  </div>
                </div>

                {/* Data Minimization Card */}
                <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-2xs font-mono">
                  <div className="flex items-center gap-2 mb-3">
                    <Lock className="w-4 h-4 text-zinc-700" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-950">
                      Data Minimization Model
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed mb-4 font-sans">
                    The agents exchange minimal signed claims rather than exposing raw bank accounts or full ERP databases.
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                      <div className="font-semibold text-zinc-950 flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Shared as Factual Claims</span>
                      </div>
                      <ul className="text-zinc-600 space-y-0.5 text-[11px] list-disc list-inside">
                        <li>Overdue invoice ID (INV-2026-1042)</li>
                        <li>Verified debt amount (€10,000)</li>
                        <li>Max compliant payment today (€4,000)</li>
                        <li>Forecasted compliant date (the 14th)</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                      <div className="font-semibold text-zinc-950 flex items-center gap-1.5 mb-1">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Kept Strictly Private</span>
                      </div>
                      <ul className="text-zinc-600 space-y-0.5 text-[11px] list-disc list-inside">
                        <li>Buyer raw bank balance (€24,000)</li>
                        <li>Full corporate transaction histories</li>
                        <li>Internal pricing formulas & secrets</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Protocol Stream & Settlement Execution (7 cols) */}
              <div className="lg:col-span-7 space-y-6 font-mono">
                {/* View Switcher Tabs */}
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setActiveTab('stream')}
                      className={`text-xs font-bold pb-2 transition-colors cursor-pointer border-b-2 -mb-2 uppercase tracking-wider ${
                        activeTab === 'stream'
                          ? 'border-black text-black'
                          : 'border-transparent text-zinc-400 hover:text-zinc-700'
                      }`}
                    >
                      Stream ({demoState?.timeline?.length ?? 0})
                    </button>
                    <button
                      onClick={() => setActiveTab('mandate')}
                      className={`text-xs font-bold pb-2 transition-colors cursor-pointer border-b-2 -mb-2 uppercase tracking-wider ${
                        activeTab === 'mandate'
                          ? 'border-black text-black'
                          : 'border-transparent text-zinc-400 hover:text-zinc-700'
                      }`}
                    >
                      Mandate Defense
                    </button>
                    <button
                      onClick={() => setActiveTab('audit')}
                      className={`text-xs font-bold pb-2 transition-colors cursor-pointer border-b-2 -mb-2 uppercase tracking-wider ${
                        activeTab === 'audit'
                          ? 'border-black text-black'
                          : 'border-transparent text-zinc-400 hover:text-zinc-700'
                      }`}
                    >
                      Audit ({demoState?.auditLog?.length ?? 0})
                    </button>
                    <button
                      onClick={() => setActiveTab('optimizer')}
                      className={`text-xs font-bold pb-2 transition-colors cursor-pointer border-b-2 -mb-2 flex items-center gap-1.5 uppercase tracking-wider ${
                        activeTab === 'optimizer'
                          ? 'border-black text-black'
                          : 'border-transparent text-zinc-400 hover:text-zinc-700'
                      }`}
                    >
                      <span>Cash Calendar</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('treasury')}
                      className={`text-xs font-bold pb-2 transition-colors cursor-pointer border-b-2 -mb-2 flex items-center gap-1.5 uppercase tracking-wider ${
                        activeTab === 'treasury'
                          ? 'border-black text-black'
                          : 'border-transparent text-zinc-400 hover:text-zinc-700'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Treasury BI</span>
                    </button>
                  </div>

                  <button
                    onClick={exportAudit}
                    disabled={!demoState}
                    className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-black disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>JSON</span>
                  </button>
                </div>

                {/* Tab 1: Protocol Stream */}
                {activeTab === 'stream' && (
                  <div className="space-y-3">
                    {demoState?.timeline?.map((event, idx) => (
                      <div
                        key={event.id}
                        className={`bg-white rounded-xl border p-4 shadow-2xs transition-all animate-fadeIn ${
                          idx === (demoState?.timeline?.length ?? 0) - 1
                            ? 'border-black ring-2 ring-zinc-900/10'
                            : 'border-zinc-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-zinc-100 text-zinc-700 font-semibold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-zinc-200">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-xs font-bold text-zinc-950">{event.actorName}</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                                  {event.claimType}
                                </span>
                                {event.signatureVerified && (
                                  <span className="text-[10px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    ✓ Ed25519 Verified
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-zinc-600 leading-relaxed font-sans">{event.summary}</p>
                              <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-400">
                                <span>Source: {event.evidenceSource}</span>
                                <span>•</span>
                                <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                              </div>
                            </div>
                          </div>

                          {event.details && (
                            <button
                              onClick={() => {
                                const c = demoState?.claims.find(
                                  (x) => x.claimId === (event.details as { claimId?: string }).claimId || x.claimId === event.id
                                );
                                if (c) setSelectedClaim(c);
                              }}
                              className="text-xs font-medium text-zinc-600 hover:text-black border border-zinc-200 px-2.5 py-1 rounded-lg hover:bg-zinc-50 shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Payload</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {(!demoState || demoState.timeline.length === 0) && (
                      <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center text-zinc-400 text-xs shadow-2xs">
                        Click &ldquo;Live Settlement&rdquo; or &ldquo;Step&rdquo; to begin the autonomous negotiation in real time.
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Mandate Defense & 11 Checks */}
                {activeTab === 'mandate' && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-2xs">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-950 mb-3">
                        Bounded Mandate Constraints
                      </h4>
                      {demoState?.mandate ? (
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-zinc-400">Per-Payment Ceiling:</span>
                            <div className="font-bold text-zinc-950">€{demoState.mandate.maxAmountPerPayment.toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-zinc-400">Daily Spending Limit:</span>
                            <div className="font-bold text-zinc-950">€{demoState.mandate.maxDailyAmount.toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-zinc-400">Cumulative Cap:</span>
                            <div className="font-bold text-zinc-950">€{demoState.mandate.maxCumulativeAmount.toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-zinc-400">Future-Dated Payments:</span>
                            <div className="font-bold text-zinc-950">Allowed</div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400">Awaiting mandate load...</p>
                      )}
                    </div>

                    <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-2xs">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-950 mb-3">
                        Deterministic Policy Engine Results (No LLM Risk)
                      </h4>
                      <div className="space-y-2">
                        {demoState?.payments
                          ?.flatMap((p) => p.policyEvaluation?.checks ?? [])
                          .map((c, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                {c.result === 'PASS' ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-rose-600" />
                                )}
                                <div>
                                  <div className="font-semibold text-zinc-950">{c.checkName}</div>
                                  <div className="text-[11px] text-zinc-500">{c.description}</div>
                                </div>
                              </div>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  c.result === 'PASS'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {c.result}
                              </span>
                            </div>
                          ))}
                        {(!demoState?.payments || demoState.payments.length === 0) && (
                          <p className="text-xs text-zinc-400 py-4 text-center">
                            Checks will execute prior to payment dispatch.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 3: Audit Log */}
                {activeTab === 'audit' && (
                  <div className="bg-white rounded-xl border border-zinc-200 shadow-2xs overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 text-[10px] font-semibold uppercase">
                        <tr>
                          <th className="py-2.5 px-4">Time</th>
                          <th className="py-2.5 px-4">Actor</th>
                          <th className="py-2.5 px-4">Action</th>
                          <th className="py-2.5 px-4">Policy Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {demoState?.auditLog?.map((e) => (
                          <tr key={e.id} className="hover:bg-zinc-50">
                            <td className="py-2.5 px-4 text-zinc-400 font-mono text-[11px]">
                              {new Date(e.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-zinc-950">{e.actor}</td>
                            <td className="py-2.5 px-4 text-zinc-600">{e.action}</td>
                            <td className="py-2.5 px-4">
                              {e.policyDecision ? (
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                    e.policyDecision.startsWith('PASS')
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {e.policyDecision}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Tab 4: Cash Calendar & Fraud Defense Optimizer */}
                {activeTab === 'optimizer' && (
                  <div className="space-y-4">
                    {/* 1. Dynamic Cash Calendar */}
                    <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-2xs">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-zinc-800" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-950">
                            Dynamic Cashflow & Early-Settlement Optimizer
                          </h4>
                        </div>
                        <span className="text-[10px] font-semibold bg-zinc-100 text-zinc-800 px-2 py-0.5 rounded border border-zinc-200">
                          SME Cashflow Protection
                        </span>
                      </div>

                      <p className="text-xs text-zinc-500 mb-4 leading-relaxed font-sans">
                        Rather than rigid 30-day payment defaults or 20% factoring cuts, autonomous agents dynamically negotiate sliding-scale terms based on live PSD2 liquidity.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        <div
                          onClick={() => setAcceleratedMode(false)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer ${
                            !acceleratedMode
                              ? 'border-black bg-zinc-50 ring-2 ring-zinc-900/10'
                              : 'border-zinc-200 hover:border-zinc-300'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-zinc-950">14-Day Split Schedule</span>
                            <span className="text-[10px] text-zinc-500 font-mono">Standard Term</span>
                          </div>
                          <div className="text-base font-bold text-zinc-950 mt-1">€10,000.00 EUR</div>
                          <p className="text-[11px] text-zinc-500 mt-1 font-sans">
                            €4,000 today + €6,000 on the 14th. Preserves €20k cash buffer.
                          </p>
                        </div>

                        <div
                          onClick={() => setAcceleratedMode(true)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer ${
                            acceleratedMode
                              ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/10'
                              : 'border-zinc-200 hover:border-zinc-300'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-emerald-900">3-Day Accelerated Settlement</span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                              Save €250 (2.5%)
                            </span>
                          </div>
                          <div className="text-base font-bold text-emerald-800 mt-1">€9,750.00 EUR</div>
                          <p className="text-[11px] text-zinc-500 mt-1 font-sans">
                            Full settlement in 72h. Supplier gets instant liquidity; Buyer saves €250.
                          </p>
                        </div>
                      </div>

                      <div className="p-3 bg-zinc-50 rounded-lg text-[11px] text-zinc-600 flex justify-between items-center font-mono">
                        <span>Active Settlement Model:</span>
                        <span className="font-bold text-zinc-950">
                          {acceleratedMode ? 'Dynamic 2.5% Discounted (€9,750)' : 'Deterministic 2-Tranche Split (€10,000)'}
                        </span>
                      </div>
                    </div>

                    {/* 2. Receivable Double-Financing Shield */}
                    <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-2xs">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-zinc-800" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-950">
                            Receivable Integrity & Double-Factoring Shield
                          </h4>
                        </div>
                        <span className="text-[10px] font-semibold bg-zinc-100 text-zinc-800 px-2 py-0.5 rounded border border-zinc-200">
                          TransCare Fraud Shield
                        </span>
                      </div>

                      <p className="text-xs text-zinc-500 mb-3 leading-relaxed font-sans">
                        Protects against the TransCare double-financing scam. When an invoice is verified, the network registers an immutable cryptographic lien preventing duplicate claims.
                      </p>

                      <div className="space-y-2 text-xs font-mono">
                        <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 flex justify-between items-center">
                          <span className="text-zinc-500">Invoice Hash Commitment:</span>
                          <span className="text-zinc-800 text-[11px] font-bold">SHA512: 8f4b...c291</span>
                        </div>
                        <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 flex justify-between items-center">
                          <span className="text-zinc-500">Lien Registry Status:</span>
                          <span className="text-emerald-800 font-bold">✓ SINGLE_CREDITOR_LOCK (Nordic Components AB)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 5: Treasury BI & PSD2 Triangulation Layer */}
                {activeTab === 'treasury' && (() => {
                  const treasury = TreasuryIntelligenceService.getBuyerTreasuryState(buyerBankBalance, buyerReserve, invoiceAmount);
                  return (
                    <div className="space-y-4 animate-fadeIn">
                      {/* Treasury Metrics Overview */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                        <div className="bg-white p-3.5 rounded-xl border border-zinc-200 shadow-2xs">
                          <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Consolidated Cash</span>
                          <span className="text-base font-bold text-zinc-950 mt-0.5 block">
                            €{treasury.consolidatedCashBalance.toLocaleString()} {treasury.currency}
                          </span>
                          <span className="text-[10px] text-zinc-500 mt-0.5 block">
                            SEB + Nordea APIs
                          </span>
                        </div>

                        <div className="bg-white p-3.5 rounded-xl border border-zinc-200 shadow-2xs">
                          <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Safe Outflow Capacity</span>
                          <span className="text-base font-bold text-emerald-800 mt-0.5 block">
                            €{treasury.safePaymentCapacityToday.toLocaleString()} {treasury.currency}
                          </span>
                          <span className="text-[10px] text-zinc-500 mt-0.5 block">
                            Over €{treasury.operationalReserve.toLocaleString()} reserve
                          </span>
                        </div>

                        <div className="bg-white p-3.5 rounded-xl border border-zinc-200 shadow-2xs">
                          <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Cash Runway</span>
                          <span className="text-base font-bold text-zinc-950 mt-0.5 block">
                            {treasury.runwayDays} Days
                          </span>
                          <span className="text-[10px] text-zinc-500 mt-0.5 block">
                            Payroll covered: Day 25
                          </span>
                        </div>

                        <div className="bg-white p-3.5 rounded-xl border border-zinc-200 shadow-2xs">
                          <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Data Triangulation</span>
                          <span className="text-base font-bold text-zinc-950 mt-0.5 block">
                            {treasury.psd2DataQualityReport.triangulatedCompletenessAvg.toFixed(1)}%
                          </span>
                          <span className="text-[10px] text-zinc-500 mt-0.5 block">
                            {treasury.psd2DataQualityReport.defectsCaughtCount} defects reconciled
                          </span>
                        </div>
                      </div>

                      {/* 1. Problem 5: 30-Day Cash Runway & Explainable AI Curve */}
                      <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-2xs font-mono">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-zinc-800" />
                            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-950">
                              30-Day Liquidity Forecast & Autonomous CFO Curve
                            </h4>
                          </div>
                          <span className="text-[10px] font-semibold bg-zinc-100 text-zinc-800 px-2 py-0.5 rounded border border-zinc-200">
                            Real-Time Runway
                          </span>
                        </div>

                        <p className="text-xs text-zinc-500 mb-4 leading-relaxed font-sans">
                          Visual proof of why the Buyer Agent dynamically proposed <strong>€4,000 today + €6,000 on the 14th</strong> rather than an arbitrary full payment.
                        </p>

                        {/* Visual Step-by-Step Runway Timeline */}
                        <div className="space-y-2 mb-4">
                          {treasury.dailyProjections.filter(p => [0, 14, 25].includes(p.dayOffset)).map((point) => (
                            <div
                              key={point.dayOffset}
                              className={`p-3 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
                                point.dayOffset === 0
                                  ? 'bg-zinc-50 border-zinc-200'
                                  : point.dayOffset === 14
                                  ? 'bg-emerald-50/50 border-emerald-200'
                                  : 'bg-zinc-100/50 border-zinc-300'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-white border rounded text-zinc-800">
                                  {point.dayOffset === 0 ? 'Today (Day 0)' : `Day ${point.dayOffset} (${point.date})`}
                                </span>
                                <div>
                                  <span className="font-semibold text-zinc-950 block text-xs">
                                    {point.events.join(' • ')}
                                  </span>
                                  <span className="text-[11px] text-zinc-500">
                                    Inflows: +€{point.scheduledInflows.toLocaleString()} | Outflows: -€{point.scheduledOutflows.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-zinc-400 block">Projected Cash</span>
                                <span className="font-bold text-zinc-950 text-sm font-mono">
                                  €{point.projectedBalance.toLocaleString()} EUR
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-200 text-xs text-zinc-700 leading-relaxed flex items-start gap-2.5 font-sans">
                          <AlertTriangle className="w-4 h-4 text-zinc-800 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-zinc-950">Insolvency Prevention Metric:</span> If the agent had paid full €10,000 upfront today, balance on Day 25 would drop to <strong className="text-rose-700">-€4,000 deficit</strong> during payroll. By executing €4k today and deferring €6k to Day 14 (when €12.5k customer receipts arrive via Zwapgrid), the company maintains a healthy <strong className="text-emerald-700">+€8,500 surplus</strong> after payroll.
                          </div>
                        </div>
                      </div>

                      {/* 2. Problem 1: PSD2 Data Fragmentation & Triangulation Pipeline */}
                      <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-2xs font-mono">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-zinc-800" />
                            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-950">
                              PSD2 Plumbing Cleansing & Triangulation Engine
                            </h4>
                          </div>
                          <span className="text-[10px] font-semibold bg-zinc-100 text-zinc-800 px-2 py-0.5 rounded border border-zinc-200">
                            Data Reconciliation
                          </span>
                        </div>

                        <p className="text-xs text-zinc-500 mb-4 leading-relaxed font-sans">
                          Bank PSD2 APIs return incomplete data. Handslag triangulates raw bank feeds with Zwapgrid ERP ledgers to produce 100% reconciled records.
                        </p>

                        <div className="space-y-3 text-xs">
                          {treasury.triangulatedFeed.map((tx) => (
                            <div key={tx.id} className="border border-zinc-200 rounded-xl p-3.5 bg-zinc-50">
                              <div className="flex justify-between items-start mb-2.5 pb-2 border-b border-zinc-200">
                                <div>
                                  <span className="font-mono text-[10px] text-zinc-400 block">{tx.bookingDate} • ID: {tx.id}</span>
                                  <span className="font-bold text-zinc-950 text-xs">{tx.rawBankEntry.bank}</span>
                                </div>
                                <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                  {(tx.erpEnrichment.reconciliationConfidence * 100).toFixed(1)}% Triangulated
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Left: Raw Incomplete PSD2 */}
                                <div className="p-2.5 bg-rose-50/60 rounded-lg border border-rose-200/80 text-[11px]">
                                  <span className="text-[10px] font-bold uppercase text-rose-700 block mb-1">
                                    Raw PSD2 Bank Data ({tx.rawBankEntry.completenessScore}% Completeness)
                                  </span>
                                  <div className="font-mono text-zinc-700 space-y-0.5">
                                    <div>Counterparty: <span className="text-rose-600 font-bold">{tx.rawBankEntry.rawCounterpartyName || '[NULL — Missing in Bank API]'}</span></div>
                                    <div>Amount: <span className="font-bold">{tx.rawBankEntry.amount} {tx.rawBankEntry.currency}</span></div>
                                    <div className="truncate">Remittance: <span className="text-zinc-500">{tx.rawBankEntry.rawRemittance}</span></div>
                                  </div>
                                </div>

                                {/* Right: Handslag Enriched Ledger */}
                                <div className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-200/80 text-[11px]">
                                  <span className="text-[10px] font-bold uppercase text-emerald-800 block mb-1">
                                    Triangulated via {tx.erpEnrichment.sourceSystem} (100% Enriched)
                                  </span>
                                  <div className="font-mono text-zinc-800 space-y-0.5">
                                    <div>Counterparty: <span className="font-bold text-emerald-800">{tx.erpEnrichment.verifiedCounterpartyName} ({tx.erpEnrichment.verifiedOrgNumber})</span></div>
                                    <div>Invoice Ref: <span className="font-bold">{tx.erpEnrichment.matchedInvoiceNumber}</span></div>
                                    <div>Settlement Account: <span className="text-zinc-600">{tx.erpEnrichment.verifiedIban}</span></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Claim Payload Inspector Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-zinc-200 font-mono">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
                  CRYPTOGRAPHIC CLAIM ENVELOPE
                </span>
                <h3 className="text-sm font-bold text-zinc-950 mt-0.5">{selectedClaim.claimType}</h3>
              </div>
              <button
                onClick={() => setSelectedClaim(null)}
                className="text-zinc-400 hover:text-black p-1 rounded-lg text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 font-mono">
                <span className="text-zinc-500 text-[10px]">Evidence Hash (SHA-512):</span>
                <div className="text-zinc-900 break-all text-[11px] mt-0.5">{selectedClaim.evidenceHash}</div>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] mb-1 block">Payload Data:</span>
                <pre className="bg-zinc-900 text-zinc-100 p-3 rounded-lg overflow-auto max-h-56 font-mono text-[11px]">
                  {JSON.stringify(selectedClaim.payload, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedClaim(null)}
                className="px-4 py-2 bg-black text-white rounded-lg text-xs font-semibold hover:bg-zinc-800 cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEPA Payment Remittance Advice Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-zinc-200 font-mono">
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-zinc-100">
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase tracking-wider">
                  EPC / PSD2 SEPA Remittance Advice
                </span>
                <h3 className="text-sm font-bold text-zinc-950 mt-1">
                  Payment Instruction: €{selectedPayment.amount.toLocaleString()}.00 {selectedPayment.currency}
                </h3>
              </div>
              <button
                onClick={() => setSelectedPayment(null)}
                className="text-zinc-400 hover:text-black p-1 rounded-lg text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                <div>
                  <span className="text-[10px] text-zinc-400 block">Debtor (Payer) Account:</span>
                  <span className="font-semibold text-zinc-950">SE33 5000 0000 0549 1000 0001</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">Creditor (Payee) Account:</span>
                  <span className="font-semibold text-zinc-950">SE42 5000 0000 0549 2000 0002</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">Creditor Name:</span>
                  <span className="font-semibold text-zinc-950">Nordic Components AB</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">Execution Date:</span>
                  <span className="font-semibold text-emerald-800">{selectedPayment.executionDate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">Verification of Payee (VoP):</span>
                  <span className="font-semibold text-emerald-800">✓ MATCH (100% Validated)</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">SCA Approach:</span>
                  <span className="font-semibold text-zinc-800">Decoupled PSU App Approval</span>
                </div>
              </div>

              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                <span className="text-[10px] text-zinc-400 block">End-to-End Identification / Idempotency:</span>
                <span className="text-zinc-800 break-all text-[11px] font-bold">{selectedPayment.idempotencyKey}</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedPayment(null)}
                className="px-4 py-2 bg-black text-white rounded-lg text-xs font-semibold hover:bg-zinc-800 cursor-pointer shadow-xs"
              >
                Close Remittance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
