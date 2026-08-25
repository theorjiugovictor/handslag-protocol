'use client';

import { useState } from 'react';
import {
  Network,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Activity,
  Building2,
  FileSpreadsheet,
  LogOut,
  Sparkles,
  Zap,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  Database,
} from 'lucide-react';
import { useSession } from '../auth/SessionProvider';
import { useNegotiationList, type NegotiationSummary } from '../realtime/useNegotiation';
import { useEventSource } from '../realtime/useEventSource';
import { TreasuryIntelligenceService } from '@/lib/services/treasury-intelligence';

const STATE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  EVIDENCE_REQUESTED: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Evidence Requested' },
  SUPPLIER_EVIDENCE_PRESENTED: { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'Evidence Presented' },
  BUYER_MATCH_PENDING: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Awaiting Match' },
  OBLIGATION_VERIFIED: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Obligation Verified' },
  INITIAL_PROPOSAL: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Proposal Pending' },
  COUNTERPROPOSAL: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Counterproposal' },
  AGREEMENT_REACHED: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Agreement Reached' },
  POLICY_VALIDATION: { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'Policy Validation' },
  PAYMENT_INITIATED: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Payment Initiated' },
  PAYMENT_SCHEDULED: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Payment Scheduled' },
  COMPLETED: { bg: 'bg-stone-900', text: 'text-white', label: 'Completed' },
  REJECTED: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Rejected' },
};

interface NegotiationInboxProps {
  onSelectNegotiation: (id: string) => void;
  onStartSoloDemo: () => void;
}

export default function NegotiationInbox({ onSelectNegotiation, onStartSoloDemo }: NegotiationInboxProps) {
  const { session, logout } = useSession();
  const { negotiations, loading, createNegotiation } = useNegotiationList();
  const { connected } = useEventSource(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'opportunities'>('active');
  const [autoInitiatingId, setAutoInitiatingId] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    counterpartyCode: '',
    invoiceNumber: `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    amount: 10000,
    currency: 'EUR',
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Pull auto-detected opportunities from Treasury Intelligence Layer
  const detectedOpportunities = TreasuryIntelligenceService.getDetectedOpportunities(session?.companyCode || 'NORDIC');

  const handleCreate = async () => {
    if (!createForm.counterpartyCode || !createForm.invoiceNumber || !createForm.amount) return;
    setCreating(true);
    setCreateError(null);
    const result = await createNegotiation(createForm);
    if (result.success) {
      setShowCreate(false);
      onSelectNegotiation(result.negotiation.id);
    } else {
      setCreateError(result.error);
    }
    setCreating(false);
  };

  const handleAutoInitiate = async (opp: typeof detectedOpportunities[0]) => {
    setAutoInitiatingId(opp.id);
    const result = await createNegotiation({
      counterpartyCode: opp.counterpartyCode,
      invoiceNumber: opp.invoiceNumber,
      amount: opp.amount,
      currency: opp.currency,
    });
    setAutoInitiatingId(null);
    if (result.success) {
      onSelectNegotiation(result.negotiation.id);
    }
  };

  const needsMyAction = (n: NegotiationSummary) => {
    if (n.myRole === 'BUYER' && n.state === 'SUPPLIER_EVIDENCE_PRESENTED') return true;
    if (n.myRole === 'BUYER' && n.state === 'INITIAL_PROPOSAL') return true;
    if (n.myRole === 'SUPPLIER' && n.state === 'COUNTERPROPOSAL') return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-[#fafaf9]">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-white text-base">
                🤝
              </div>
              <div>
                <span className="font-bold text-stone-900 text-sm tracking-tight">Handslag Protokoll</span>
                <span className="ml-2 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`}></span>
                  {connected ? 'LIVE' : 'CONNECTING'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-stone-100 px-3 py-1.5 rounded-lg border border-stone-200">
              <Building2 className="w-3.5 h-3.5 text-stone-600" />
              <span className="text-xs font-bold text-stone-900">{session?.organizationName}</span>
              <span className="text-[10px] font-mono text-stone-500 bg-white px-1.5 py-0.5 rounded border border-stone-200">
                {session?.companyCode}
              </span>
            </div>
            <button
              onClick={onStartSoloDemo}
              className="text-xs font-medium text-stone-500 hover:text-stone-700 px-3 py-1.5 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
            >
              Solo Demo
            </button>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-16">
        {/* Treasury Intelligence Header Banner */}
        <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 text-white rounded-2xl p-6 mb-8 shadow-sm border border-stone-800">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 font-mono">
                  Autonomous Treasury & ERP Triangulation Layer
                </span>
              </div>
              <h2 className="text-lg font-bold text-white">
                Live Liquidity Intelligence & Auto-Detected Deals
              </h2>
              <p className="text-xs text-stone-300 mt-1 max-w-2xl leading-relaxed">
                Ingests accounts receivable from Zwapgrid ERP and live bank feeds from SEB & Nordea PSD2 APIs. Detects overdue invoices and generates optimal settlement terms automatically.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-stone-950 rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Custom Settlement
              </button>
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center justify-between border-b border-stone-200 mb-6">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('active')}
              className={`text-xs font-bold pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === 'active'
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}
            >
              <span>Live Negotiations</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-stone-100 font-mono">
                {negotiations.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('opportunities')}
              className={`text-xs font-bold pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === 'opportunities'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>AI Auto-Detected Invoices</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold">
                {detectedOpportunities.length} Ready
              </span>
            </button>
          </div>
        </div>

        {/* AI Detected Opportunities Tab */}
        {activeTab === 'opportunities' && (
          <div className="space-y-4 mb-8 animate-fadeIn">
            <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
              <Zap className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Automated Pipeline:</span> These receivables were identified by correlating Zwapgrid ERP ledger entries with Open Payments cash runway projections. Click <strong>Auto-Initiate</strong> to launch a cryptographically signed Handslag negotiation with pre-calculated terms.
              </div>
            </div>

            <div className="space-y-3">
              {detectedOpportunities.map((opp) => (
                <div
                  key={opp.id}
                  className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs hover:border-emerald-400 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-bold text-stone-900 font-mono">
                          {opp.invoiceNumber}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono">
                          {opp.detectionType.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] font-semibold text-stone-500 font-mono">
                          Source: {opp.sourceSystem}
                        </span>
                      </div>

                      <div className="text-xs text-stone-600 font-medium">
                        Target Counterparty: <strong className="text-stone-900">{opp.counterpartyName}</strong> ({opp.counterpartyCode}) • Amount: <strong className="text-stone-900 font-mono">€{opp.amount.toLocaleString()} {opp.currency}</strong>
                      </div>

                      <p className="text-xs text-stone-500 max-w-2xl leading-relaxed">
                        💡 <span className="font-semibold text-stone-700">AI CFO Rationale:</span> {opp.aiRationale}
                      </p>
                    </div>

                    <button
                      onClick={() => handleAutoInitiate(opp)}
                      disabled={autoInitiatingId === opp.id}
                      className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{autoInitiatingId === opp.id ? 'Initiating...' : 'Auto-Initiate Handslag'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom Create Negotiation Form Modal */}
        {showCreate && (
          <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6 shadow-sm animate-fadeIn">
            <h3 className="text-sm font-bold text-stone-900 mb-4 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Initiate Custom Settlement Negotiation
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[11px] font-medium text-stone-500 block mb-1">Counterparty Code</label>
                <input
                  type="text"
                  value={createForm.counterpartyCode}
                  onChange={(e) => setCreateForm(f => ({ ...f, counterpartyCode: e.target.value.toUpperCase() }))}
                  placeholder="e.g. AURORA"
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm font-mono focus:outline-none focus:border-stone-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-stone-500 block mb-1">Invoice Number</label>
                <input
                  type="text"
                  value={createForm.invoiceNumber}
                  onChange={(e) => setCreateForm(f => ({ ...f, invoiceNumber: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm font-mono focus:outline-none focus:border-stone-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-stone-500 block mb-1">Amount (€)</label>
                <input
                  type="number"
                  value={createForm.amount}
                  onChange={(e) => setCreateForm(f => ({ ...f, amount: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm font-mono focus:outline-none focus:border-stone-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-stone-500 block mb-1">Currency</label>
                <input
                  type="text"
                  value={createForm.currency}
                  onChange={(e) => setCreateForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm font-mono focus:outline-none focus:border-stone-500"
                />
              </div>
            </div>
            {createError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 mb-4">
                {createError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating || !createForm.counterpartyCode}
                className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-semibold hover:bg-stone-800 disabled:opacity-40 transition-colors cursor-pointer"
              >
                {creating ? 'Creating...' : 'Create & Present Invoice Claim'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg text-xs font-semibold hover:bg-stone-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Live Active Negotiation List */}
        {activeTab === 'active' && (
          <>
            {loading ? (
              <div className="text-center py-12 text-stone-400 text-sm">Loading negotiations...</div>
            ) : negotiations.length === 0 ? (
              <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
                <Network className="w-8 h-8 text-stone-300 mx-auto mb-3" />
                <p className="text-sm text-stone-600 font-semibold mb-1">No active negotiations in progress</p>
                <p className="text-xs text-stone-400 mb-6">
                  Select an AI-detected opportunity above or create a custom settlement.
                </p>
                <button
                  onClick={() => setActiveTab('opportunities')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  View {detectedOpportunities.length} AI Detected Opportunities
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {negotiations.map((n) => {
                  const stateInfo = STATE_COLORS[n.state] ?? STATE_COLORS.EVIDENCE_REQUESTED;
                  const actionNeeded = needsMyAction(n);
                  
                  return (
                    <button
                      key={n.id}
                      onClick={() => onSelectNegotiation(n.id)}
                      className={`w-full bg-white rounded-xl border p-5 text-left transition-all cursor-pointer hover:shadow-md group ${
                        actionNeeded
                          ? 'border-amber-300 ring-2 ring-amber-200/50'
                          : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] font-medium text-stone-400 uppercase">{n.myRole}</span>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              n.myRole === 'SUPPLIER' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                            }`}>
                              <Building2 className="w-4 h-4" />
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-bold text-stone-900 font-mono">{n.invoiceId}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${stateInfo.bg} ${stateInfo.text}`}>
                                {stateInfo.label}
                              </span>
                              {actionNeeded && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-1">
                                  <Activity className="w-3 h-3" />
                                  Your Turn
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-stone-500">
                              {n.myRole === 'SUPPLIER' ? `→ ${n.buyerOrg}` : `← ${n.supplierOrg}`}
                              <span className="mx-2">•</span>
                              <span className="font-mono">{n.claimCount} claims</span>
                              <span className="mx-1">·</span>
                              <span className="font-mono">{n.proposalCount} proposals</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right text-xs text-stone-400">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {new Date(n.updatedAt).toLocaleTimeString()}
                          </div>
                          <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-stone-600 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
