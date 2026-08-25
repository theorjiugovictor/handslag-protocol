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
} from 'lucide-react';

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

export default function SettlementNetworkApp() {
  const [demoState, setDemoState] = useState<DemoState | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'dashboard' | 'distributed'>('dashboard');
  const [activeTab, setActiveTab] = useState<'stream' | 'mandate' | 'audit' | 'optimizer'>('stream');
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
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-semibold text-sm">
                S
              </div>
              <div>
                <span className="font-bold text-slate-900 text-sm tracking-tight">Settlement Network</span>
                <span className="ml-2 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  Autonomous B2B
                </span>
                <span className="ml-2 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  SANDBOX
                </span>
              </div>
            </div>

            {/* View Mode Toggle: Dashboard vs Distributed System */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
              <button
                onClick={() => setViewMode('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'dashboard'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard View</span>
              </button>
              <button
                onClick={() => setViewMode('distributed')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'distributed'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Network className="w-3.5 h-3.5 text-indigo-600" />
                <span>Distributed Network Flow</span>
              </button>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowConfigDrawer((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                showConfigDrawer
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
              title="Configure custom invoice and agent mandate parameters"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
              <span>Agent Parameters</span>
              {showConfigDrawer ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
            </button>

            <button
              onClick={startRealtimeFlow}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isPlayingFlow
                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
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
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <StepForward className="w-3.5 h-3.5" />
              <span>Step</span>
            </button>

            {/* Speed Selector */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-medium">
              <button
                onClick={() => setFlowSpeed(3600)}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  flowSpeed === 3600 ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Relaxed presentation speed (3.6s/step)"
              >
                0.5x
              </button>
              <button
                onClick={() => setFlowSpeed(2600)}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  flowSpeed === 2600 ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Standard presentation speed (2.6s/step)"
              >
                1x
              </button>
              <button
                onClick={() => setFlowSpeed(1500)}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  flowSpeed === 1500 ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Brisk speed (1.5s/step)"
              >
                1.5x
              </button>
            </div>

            <button
              onClick={runRejectionApi}
              disabled={loading || isPlayingFlow}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Test Rejection</span>
            </button>

            <button
              onClick={resetApi}
              disabled={loading}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Dynamic Agent Mandate Playground Drawer */}
      {showConfigDrawer && (
        <div className="bg-slate-900 text-white border-b border-slate-800 px-6 py-4 animate-fadeIn">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Autonomous Agent Playground (Custom Constraints & Mandates)
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                  Live Game-Theoretic Solver
                </span>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Presets:</span>
                <button
                  onClick={() => {
                    setInvoiceAmount(10000);
                    setBuyerBankBalance(24000);
                    setBuyerReserve(20000);
                    setBuyerMandateCeiling(6000);
                    setSupplierMinUpfront(2500);
                    resetApi();
                  }}
                  className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                >
                  Standard (€10k Split)
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
                  className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
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
                  className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                >
                  Liquidity Squeeze (€15k)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                <label className="text-[11px] text-slate-400 block mb-1">Invoice Amount (€)</label>
                <input
                  type="number"
                  value={invoiceAmount}
                  onChange={(e) => {
                    setInvoiceAmount(Number(e.target.value));
                    resetApi();
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                <label className="text-[11px] text-slate-400 block mb-1">Buyer Bank Balance (€)</label>
                <input
                  type="number"
                  value={buyerBankBalance}
                  onChange={(e) => {
                    setBuyerBankBalance(Number(e.target.value));
                    resetApi();
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                <label className="text-[11px] text-slate-400 block mb-1">Operational Reserve (€)</label>
                <input
                  type="number"
                  value={buyerReserve}
                  onChange={(e) => {
                    setBuyerReserve(Number(e.target.value));
                    resetApi();
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                <label className="text-[11px] text-slate-400 block mb-1">Mandate Cap / Payment (€)</label>
                <input
                  type="number"
                  value={buyerMandateCeiling}
                  onChange={(e) => {
                    setBuyerMandateCeiling(Number(e.target.value));
                    resetApi();
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                <label className="text-[11px] text-slate-400 block mb-1">Supplier Min Upfront (€)</label>
                <input
                  type="number"
                  value={supplierMinUpfront}
                  onChange={(e) => {
                    setSupplierMinUpfront(Number(e.target.value));
                    resetApi();
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 pt-8">
        {/* Step-by-Step Progress Pipeline */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-8 card-shadow">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-3 px-1">
            <div className="flex items-center gap-2">
              <span>Protocol Progress</span>
              {isPlayingFlow && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 animate-pulse">
                  <Activity className="w-3 h-3" />
                  Live Flow Active
                </span>
              )}
            </div>
            <span className="font-semibold text-slate-900">
              {demoState?.state ? demoState.state.replace(/_/g, ' ') : 'Ready to begin'}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {PROTOCOL_STAGES.map((stage) => {
              const isPassed = currentStep >= stage.minStep;
              const isCurrent = currentStep === stage.minStep || (stage.minStep === 9 && currentStep >= 9);
              return (
                <div
                  key={stage.id}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    isPassed
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : isCurrent
                      ? 'bg-slate-100 border-slate-400 text-slate-900 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="text-[11px] font-medium truncate">{stage.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── VIEW 1: DISTRIBUTED SYSTEM FLOW ─────────────────── */}
        {viewMode === 'distributed' && (
          <div className="space-y-6">
            {/* Distributed Topology Canvas */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 card-shadow">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Network className="w-4 h-4 text-indigo-600" />
                    Distributed Principal Architecture & Cryptographic Message Wire
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Isolated runtime nodes exchanging cryptographically signed claim envelopes over an untrusted transport wire.
                  </p>
                </div>
                <div className="text-right font-mono text-xs text-slate-500">
                  <span>Transport: </span>
                  <span className="text-emerald-700 font-semibold">TLS + Ed25519 Payload Signing</span>
                </div>
              </div>

              {/* Visual Distributed Nodes & Interactive Transit Wire */}
              <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-center">
                {/* Node Alpha: Supplier Realm (4 cols) */}
                <div className="lg:col-span-4 bg-slate-50 rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">Node Alpha: Supplier VPC</span>
                    </div>
                    <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">
                      Identity A
                    </span>
                  </div>

                  <div className="text-sm font-bold text-slate-900">Nordic Components AB</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">Agent: SupplierSettlementDaemon v1</div>

                  <div className="mt-4 pt-3 border-t border-slate-200 space-y-2 text-xs font-mono">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Zwapgrid AR Consent:</span>
                      <span className="text-emerald-600 font-semibold">CONNECTED</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Private Key Storage:</span>
                      <span className="text-slate-900 font-semibold">Local Enclave</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Cross-Ledger Access:</span>
                      <span className="text-rose-600 font-semibold">BLOCKED (0-Trust)</span>
                    </div>
                  </div>
                </div>

                {/* Central Transit Bus & In-Flight Packet (3 cols) */}
                <div className="lg:col-span-3 flex flex-col items-center justify-center p-3 text-center">
                  <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2 px-2">
                    <span>Alpha</span>
                    <span className="text-indigo-600 font-bold">Transit Wire</span>
                    <span>Beta</span>
                  </div>

                  {/* Wire line with in-flight packet */}
                  <div className="w-full h-1 bg-slate-200 rounded-full relative my-3">
                    {latestEvent && (
                      <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-mono px-3 py-1 rounded-full shadow-md flex items-center gap-1.5 whitespace-nowrap animate-pulse">
                        <Lock className="w-3 h-3 text-emerald-400" />
                        <span>{latestEvent.claimType}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 font-mono mt-1">
                    {latestEvent?.actor === 'SUPPLIER_AGENT' && (
                      <span className="flex items-center gap-1 text-indigo-700 font-semibold">
                        <span>Alpha ➔ Beta</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    )}
                    {latestEvent?.actor === 'BUYER_AGENT' && (
                      <span className="flex items-center gap-1 text-sky-700 font-semibold">
                        <ArrowLeft className="w-3 h-3" />
                        <span>Beta ➔ Alpha</span>
                      </span>
                    )}
                    {!latestEvent && <span>Awaiting transmission...</span>}
                  </div>
                </div>

                {/* Node Beta: Buyer Realm (4 cols) */}
                <div className="lg:col-span-4 bg-slate-50 rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-sky-600" />
                      <span className="text-xs font-bold uppercase tracking-wider text-sky-700">Node Beta: Buyer VPC</span>
                    </div>
                    <span className="text-[10px] font-mono bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded">
                      Identity B
                    </span>
                  </div>

                  <div className="text-sm font-bold text-slate-900">Aurora Retail AB</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">Agent: BuyerSettlementDaemon v1</div>

                  <div className="mt-4 pt-3 border-t border-slate-200 space-y-2 text-xs font-mono">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Open Payments PSD2:</span>
                      <span className="text-emerald-600 font-semibold">CONNECTED</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Zwapgrid AP Consent:</span>
                      <span className="text-emerald-600 font-semibold">CONNECTED</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Raw Balance Leakage:</span>
                      <span className="text-emerald-600 font-semibold">PREVENTED</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Central Mathematical Policy Firewall & Payment Rail */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gatekeeper Firewall */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 card-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Deterministic Safety Firewall (No LLM Authority)
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                    11 Active Checks
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Every proposed settlement term must pass deterministic mathematical constraints before the Payment Controller touches the banking layer.
                </p>

                <div className="space-y-2">
                  {demoState?.payments
                    ?.flatMap((p) => p.policyEvaluation?.checks ?? [])
                    .slice(0, 5)
                    .map((c, i) => (
                      <div key={i} className="flex justify-between items-center p-2 rounded bg-slate-50 border border-slate-200 text-xs font-mono">
                        <span className="text-slate-700">{c.checkName}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          c.result === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {c.result}
                        </span>
                      </div>
                    ))}
                  {(!demoState?.payments || demoState.payments.length === 0) && (
                    <p className="text-xs text-slate-400 py-3 text-center font-mono">
                      Firewall standing by for consensus proposal...
                    </p>
                  )}
                </div>
              </div>

              {/* Message Wire Inspector */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 card-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-slate-700" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Live Message Transit Inspector ({demoState?.claims?.length ?? 0} Envelopes)
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">JSON-RPC / Ed25519</span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {demoState?.claims?.map((c) => (
                    <div
                      key={c.claimId}
                      onClick={() => setSelectedClaim(c)}
                      className="p-2.5 rounded-lg border border-slate-200 hover:border-slate-400 bg-slate-50 cursor-pointer text-xs font-mono transition-colors"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-900">{c.claimType}</span>
                        <span className="text-[10px] text-emerald-600 font-semibold">✓ {c.verificationStatus}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        Issuer: {c.issuerOrganization} • Hash: {c.evidenceHash.slice(0, 16)}...
                      </div>
                    </div>
                  ))}
                  {(!demoState?.claims || demoState.claims.length === 0) && (
                    <p className="text-xs text-slate-400 py-6 text-center font-mono">
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl border border-slate-200 p-5 card-shadow">
                <span className="text-xs font-medium text-slate-500">Overdue Invoice</span>
                <div className="text-xl font-bold text-slate-900 mt-1">INV-2026-1042</div>
                <div className="text-xs text-rose-600 font-medium mt-1">22 days overdue</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5 card-shadow">
                <span className="text-xs font-medium text-slate-500">Obligation Amount</span>
                <div className="text-xl font-bold text-slate-900 mt-1">€10,000.00 EUR</div>
                <div className="text-xs text-slate-500 mt-1">Due Aug 2, 2026</div>
              </div>
              <div
                onClick={() => demoState?.payments?.[0] && setSelectedPayment(demoState.payments[0])}
                className={`bg-white rounded-xl border p-5 card-shadow transition-all ${
                  demoState?.payments?.[0] ? 'cursor-pointer hover:border-emerald-400 hover:shadow-md' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Immediate Settlement</span>
                  {demoState?.payments?.[0] && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      View Advice ➔
                    </span>
                  )}
                </div>
                <div className="text-xl font-bold text-emerald-600 mt-1">
                  {demoState?.payments?.[0] ? '€4,000.00' : '—'}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {demoState?.payments?.[0] ? 'SEPA Instant via PSD2' : 'Pending negotiation'}
                </div>
              </div>
              <div
                onClick={() => demoState?.payments?.[1] && setSelectedPayment(demoState.payments[1])}
                className={`bg-white rounded-xl border p-5 card-shadow transition-all ${
                  demoState?.payments?.[1] ? 'cursor-pointer hover:border-slate-400 hover:shadow-md' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Scheduled Settlement</span>
                  {demoState?.payments?.[1] && (
                    <span className="text-[10px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      View Advice ➔
                    </span>
                  )}
                </div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  {demoState?.payments?.[1] ? '€6,000.00' : '—'}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {demoState?.payments?.[1] ? 'Scheduled for the 14th' : 'Pending negotiation'}
                </div>
              </div>
            </div>

            {/* 2-Column Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Autonomous Agents & Data Minimization (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                {/* Supplier Card */}
                <div className={`bg-white rounded-xl border p-5 card-shadow transition-all ${
                  currentStep === 1 || currentStep === 4 || currentStep === 7
                    ? 'border-indigo-500 ring-2 ring-indigo-500/10'
                    : 'border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">Supplier Principal</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      Ed25519 Key A
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Nordic Components AB</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Org: 556789-0123 • Sweden</p>
                  <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600 flex justify-between">
                    <span>Policy Mandate:</span>
                    <span className="font-medium text-slate-900">≥ €2,500 immediate, rest ≤ 14d</span>
                  </div>
                </div>

                {/* Buyer Card */}
                <div className={`bg-white rounded-xl border p-5 card-shadow transition-all ${
                  currentStep === 2 || currentStep === 5 || currentStep === 6
                    ? 'border-sky-500 ring-2 ring-sky-500/10'
                    : 'border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-sky-600" />
                      <span className="text-xs font-bold uppercase tracking-wider text-sky-700">Buyer Principal</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      Ed25519 Key B
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Aurora Retail AB</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Org: 559123-4568 • Sweden</p>
                  <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600 flex justify-between">
                    <span>Policy Constraint:</span>
                    <span className="font-medium text-slate-900">Preserve €20k liquidity, max €4k today</span>
                  </div>
                </div>

                {/* Data Minimization Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 card-shadow">
                  <div className="flex items-center gap-2 mb-3">
                    <Lock className="w-4 h-4 text-slate-700" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Data Minimization Model
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    The agents exchange minimal signed claims rather than exposing raw bank accounts or full ERP databases.
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="font-semibold text-emerald-800 flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Shared as Factual Claims</span>
                      </div>
                      <ul className="text-emerald-700 space-y-0.5 text-[11px] list-disc list-inside">
                        <li>Overdue invoice ID (INV-2026-1042)</li>
                        <li>Verified debt amount (€10,000)</li>
                        <li>Max compliant payment today (€4,000)</li>
                        <li>Forecasted compliant date (the 14th)</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                      <div className="font-semibold text-rose-800 flex items-center gap-1.5 mb-1">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Kept Strictly Private</span>
                      </div>
                      <ul className="text-rose-700 space-y-0.5 text-[11px] list-disc list-inside">
                        <li>Buyer raw bank balance (€24,000)</li>
                        <li>Full corporate transaction histories</li>
                        <li>Internal pricing formulas & secrets</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Protocol Stream & Settlement Execution (7 cols) */}
              <div className="lg:col-span-7 space-y-6">
                {/* View Switcher Tabs */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setActiveTab('stream')}
                      className={`text-xs font-bold pb-2 transition-colors cursor-pointer border-b-2 -mb-2 ${
                        activeTab === 'stream'
                          ? 'border-slate-900 text-slate-900'
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      Protocol Stream ({demoState?.timeline?.length ?? 0})
                    </button>
                    <button
                      onClick={() => setActiveTab('mandate')}
                      className={`text-xs font-bold pb-2 transition-colors cursor-pointer border-b-2 -mb-2 ${
                        activeTab === 'mandate'
                          ? 'border-slate-900 text-slate-900'
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      Mandate Policy Defense
                    </button>
                    <button
                      onClick={() => setActiveTab('audit')}
                      className={`text-xs font-bold pb-2 transition-colors cursor-pointer border-b-2 -mb-2 ${
                        activeTab === 'audit'
                          ? 'border-slate-900 text-slate-900'
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      Audit Log ({demoState?.auditLog?.length ?? 0})
                    </button>
                    <button
                      onClick={() => setActiveTab('optimizer')}
                      className={`text-xs font-bold pb-2 transition-colors cursor-pointer border-b-2 -mb-2 flex items-center gap-1.5 ${
                        activeTab === 'optimizer'
                          ? 'border-emerald-600 text-emerald-700 font-bold'
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Cash Calendar & Fraud Defense
                    </button>
                  </div>

                  <button
                    onClick={exportAudit}
                    disabled={!demoState}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export JSON</span>
                  </button>
                </div>

                {/* Tab 1: Protocol Stream */}
                {activeTab === 'stream' && (
                  <div className="space-y-3">
                    {demoState?.timeline?.map((event, idx) => (
                      <div
                        key={event.id}
                        className={`bg-white rounded-xl border p-4 card-shadow-hover transition-all animate-fadeIn ${
                          idx === (demoState?.timeline?.length ?? 0) - 1
                            ? 'border-slate-900 ring-2 ring-slate-900/5'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-xs font-bold text-slate-900">{event.actorName}</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  {event.claimType}
                                </span>
                                {event.signatureVerified && (
                                  <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    ✓ Ed25519 Verified
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed">{event.summary}</p>
                              <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
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
                              className="text-xs font-medium text-slate-500 hover:text-slate-900 border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-50 shrink-0 cursor-pointer flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Payload</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {(!demoState || demoState.timeline.length === 0) && (
                      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs card-shadow">
                        Click &ldquo;Live Settlement&rdquo; or &ldquo;Step&rdquo; to begin the autonomous negotiation in real time.
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Mandate Defense & 11 Checks */}
                {activeTab === 'mandate' && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-5 card-shadow">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                        Bounded Mandate Constraints
                      </h4>
                      {demoState?.mandate ? (
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-slate-400">Per-Payment Ceiling:</span>
                            <div className="font-bold text-slate-900">€{demoState.mandate.maxAmountPerPayment.toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-slate-400">Daily Spending Limit:</span>
                            <div className="font-bold text-slate-900">€{demoState.mandate.maxDailyAmount.toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-slate-400">Cumulative Cap:</span>
                            <div className="font-bold text-slate-900">€{demoState.mandate.maxCumulativeAmount.toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-slate-400">Future-Dated Payments:</span>
                            <div className="font-bold text-slate-900">Allowed</div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">Awaiting mandate load...</p>
                      )}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-5 card-shadow">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                        Deterministic Policy Engine Results (No LLM Risk)
                      </h4>
                      <div className="space-y-2">
                        {demoState?.payments
                          ?.flatMap((p) => p.policyEvaluation?.checks ?? [])
                          .map((c, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                {c.result === 'PASS' ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-rose-600" />
                                )}
                                <div>
                                  <div className="font-semibold text-slate-900">{c.checkName}</div>
                                  <div className="text-[11px] text-slate-500">{c.description}</div>
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
                          <p className="text-xs text-slate-400 py-4 text-center">
                            Checks will execute prior to payment dispatch.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 3: Audit Log */}
                {activeTab === 'audit' && (
                  <div className="bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-semibold">
                        <tr>
                          <th className="py-2.5 px-4">Time</th>
                          <th className="py-2.5 px-4">Actor</th>
                          <th className="py-2.5 px-4">Action</th>
                          <th className="py-2.5 px-4">Policy Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {demoState?.auditLog?.map((e) => (
                          <tr key={e.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">
                              {new Date(e.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-slate-900">{e.actor}</td>
                            <td className="py-2.5 px-4 text-slate-600">{e.action}</td>
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
                    {/* 1. Dynamic Cash Calendar & Early-Payment Discounting */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 card-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-emerald-600" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                            Dynamic Cashflow & Early-Settlement Optimizer
                          </h4>
                        </div>
                        <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                          Problem 5: SME Cashflow Crisis
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                        Rather than rigid 30-day payment defaults or 20% factoring agency cuts, autonomous agents dynamically negotiate sliding-scale terms based on live PSD2 liquidity.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        <div
                          onClick={() => setAcceleratedMode(false)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer ${
                            !acceleratedMode
                              ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/10'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-slate-900">14-Day Split Schedule</span>
                            <span className="text-[10px] text-slate-500 font-mono">Standard Term</span>
                          </div>
                          <div className="text-lg font-bold text-slate-900 mt-1">€10,000.00 EUR</div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            €4,000 today + €6,000 on the 14th. Preserves €20k cash buffer.
                          </p>
                        </div>

                        <div
                          onClick={() => setAcceleratedMode(true)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer ${
                            acceleratedMode
                              ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/10'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-emerald-800">3-Day Accelerated Settlement</span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                              Save €250 (2.5%)
                            </span>
                          </div>
                          <div className="text-lg font-bold text-emerald-700 mt-1">€9,750.00 EUR</div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Full settlement in 72h. Supplier gets instant liquidity; Buyer saves €250.
                          </p>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-lg text-[11px] text-slate-600 flex justify-between items-center font-mono">
                        <span>Active Settlement Model:</span>
                        <span className="font-bold text-slate-900">
                          {acceleratedMode ? 'Dynamic 2.5% Discounted (€9,750)' : 'Deterministic 2-Tranche Split (€10,000)'}
                        </span>
                      </div>
                    </div>

                    {/* 2. Receivable Double-Financing Shield (TransCare Fraud Typology) */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 card-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-sky-600" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                            Receivable Integrity & Double-Factoring Shield
                          </h4>
                        </div>
                        <span className="text-[10px] font-semibold bg-sky-50 text-sky-700 px-2 py-0.5 rounded border border-sky-200">
                          Problem 3: 150B SEK Fraud Prevention
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                        Protects against the TransCare double-financing scam cited in the hackathon brief. When an invoice is verified, the network registers an immutable cryptographic lien preventing duplicate claims across lenders.
                      </p>

                      <div className="space-y-2 text-xs font-mono">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                          <span className="text-slate-500">Invoice Hash Commitment:</span>
                          <span className="text-slate-800 text-[11px] font-bold">SHA512: 8f4b...c291</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                          <span className="text-slate-500">Lien Registry Status:</span>
                          <span className="text-emerald-700 font-bold">✓ SINGLE_CREDITOR_LOCK (Nordic Components AB)</span>
                        </div>
                      </div>
                    </div>

                    {/* 3. 180-Day PSD2 Consent & SCA Health Monitor */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 card-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                            PSD2 Consent & SCA Clock Health
                          </h4>
                        </div>
                        <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                          Problem 2: Renewal Drop-Off Defense
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">Open Payments PSD2 SCA:</span>
                          <span className="font-bold text-slate-900 text-sm">178 Days Remaining</span>
                          <span className="text-[10px] text-emerald-600 block mt-0.5">● EBA 180d Exemption Active</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">Zwapgrid Accounting Sync:</span>
                          <span className="font-bold text-slate-900 text-sm">88 Days Remaining</span>
                          <span className="text-[10px] text-emerald-600 block mt-0.5">● Graceful Local Fallback Ready</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Claim Payload Inspector Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Cryptographic Claim Envelope
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">{selectedClaim.claimType}</h3>
              </div>
              <button
                onClick={() => setSelectedClaim(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono">
                <span className="text-slate-500 text-[10px]">Evidence Hash (SHA-512):</span>
                <div className="text-slate-800 break-all text-[11px] mt-0.5">{selectedClaim.evidenceHash}</div>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] mb-1 block">Payload Data:</span>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-auto max-h-56 font-mono text-[11px]">
                  {JSON.stringify(selectedClaim.payload, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedClaim(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEPA Payment Remittance Advice Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase tracking-wider">
                  EPC / PSD2 SEPA Remittance Advice
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Payment Instruction: €{selectedPayment.amount.toLocaleString()}.00 {selectedPayment.currency}
                </h3>
              </div>
              <button
                onClick={() => setSelectedPayment(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 block">Debtor (Payer) Account:</span>
                  <span className="font-semibold text-slate-900">SE33 5000 0000 0549 1000 0001</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Creditor (Payee) Account:</span>
                  <span className="font-semibold text-slate-900">SE42 5000 0000 0549 2000 0002</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Creditor Name:</span>
                  <span className="font-semibold text-slate-900">Nordic Components AB</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Execution Date:</span>
                  <span className="font-semibold text-emerald-700">{selectedPayment.executionDate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Verification of Payee (VoP):</span>
                  <span className="font-semibold text-emerald-700">✓ MATCH (100% Validated)</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">SCA Approach:</span>
                  <span className="font-semibold text-amber-700">Decoupled PSU App Approval</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block">End-to-End Identification / Idempotency:</span>
                <span className="text-slate-700 break-all text-[11px] font-bold">{selectedPayment.idempotencyKey}</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedPayment(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 cursor-pointer"
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
