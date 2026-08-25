'use client';

import { useState } from 'react';
import {
  Plus,
  ArrowRight,
  Clock,
  Activity,
  Building2,
  FileSpreadsheet,
  LogOut,
  Database,
  CheckCircle2,
  Check,
  Zap,
} from 'lucide-react';
import { useSession } from '../auth/SessionProvider';
import { useNegotiationList, type NegotiationSummary } from '../realtime/useNegotiation';
import { useEventSource } from '../realtime/useEventSource';
import { TreasuryIntelligenceService } from '@/lib/services/treasury-intelligence';
import SettlementBasisDrawer from './SettlementBasisDrawer';

const STATE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  EVIDENCE_REQUESTED: { bg: 'bg-zinc-100 border-zinc-200', text: 'text-zinc-700', label: 'EVIDENCE REQUESTED' },
  SUPPLIER_EVIDENCE_PRESENTED: { bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-800', label: 'EVIDENCE PRESENTED' },
  BUYER_MATCH_PENDING: { bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-800', label: 'AWAITING MATCH' },
  OBLIGATION_VERIFIED: { bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-900', label: 'OBLIGATION VERIFIED' },
  INITIAL_PROPOSAL: { bg: 'bg-zinc-950 text-white border-black', text: 'text-white font-semibold', label: '1-CLICK HANDSHAKE PENDING' },
  COUNTERPROPOSAL: { bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-800', label: 'COUNTERPROPOSAL' },
  AGREEMENT_REACHED: { bg: 'bg-zinc-950 text-white border-black', text: 'text-white font-semibold', label: 'AGREEMENT REACHED' },
  POLICY_VALIDATION: { bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-800', label: 'POLICY VALIDATION' },
  PAYMENT_INITIATED: { bg: 'bg-zinc-950 text-white border-black', text: 'text-white font-semibold', label: 'PAYMENT INITIATED' },
  PAYMENT_SCHEDULED: { bg: 'bg-zinc-950 text-white border-black', text: 'text-white font-semibold', label: 'PAYMENT SCHEDULED' },
  COMPLETED: { bg: 'bg-black text-white border-black', text: 'text-white font-semibold', label: 'COMPLETED' },
  REJECTED: { bg: 'bg-zinc-100 border-zinc-200', text: 'text-zinc-400', label: 'REJECTED' },
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

  const isAwaitingMyHandshake = (n: NegotiationSummary) => {
    return n.myRole === 'BUYER' && n.state === 'INITIAL_PROPOSAL';
  };

  return (
    <div className="min-h-screen bg-white text-zinc-950 selection:bg-black selection:text-white font-sans antialiased bg-grid-light">
      {/* Header */}
      <header className="bg-white/90 border-b border-zinc-200 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shadow-xs">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 12L10 6L14 10L20 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 20L10 14L14 18L20 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-zinc-950 text-xs font-mono tracking-[0.2em] uppercase">HANDSLAG</span>
              <span className="ml-3 text-[9px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 inline-flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-black animate-pulse' : 'bg-zinc-400'}`}></span>
                {connected ? 'NETWORK CONNECTED' : 'CONNECTING'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-zinc-50 px-3.5 py-1.5 rounded-lg border border-zinc-200">
              <Building2 className="w-3.5 h-3.5 text-zinc-600" />
              <span className="text-xs font-medium text-zinc-950 tracking-tight">{session?.organizationName}</span>
              <span className="text-[10px] font-mono text-zinc-600 bg-white px-1.5 py-0.5 rounded border border-zinc-200">
                {session?.companyCode}
              </span>
            </div>
            <button
              onClick={onStartSoloDemo}
              className="text-xs font-mono text-zinc-500 hover:text-black px-3 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer uppercase tracking-wider"
            >
              Simulation
            </button>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-zinc-400 hover:text-black hover:bg-zinc-100 transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 pt-10 pb-20">
        {/* Treasury Intelligence Header Banner */}
        <div className="bg-zinc-50 rounded-2xl p-7 mb-10 border border-zinc-200 shadow-2xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500">
                  TREASURY BI & ERP TRIANGULATION
                </span>
              </div>
              <h2 className="text-base font-medium text-zinc-950 tracking-tight">
                Liquidity Reconciliation & Autonomous Handslag
              </h2>
              <p className="text-xs text-zinc-600 mt-1.5 max-w-2xl leading-relaxed">
                Ingests ERP ledgers and verifies multi-bank PSD2 cashflow runways. Autonomous agents negotiate mathematically optimal tranches, awaiting only a final 1-click confirmation.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowCreate(true)}
                className="px-4 py-2 bg-black hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold tracking-wider uppercase transition-all shadow-xs cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 inline mr-1" />
                Custom Deal
              </button>
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center justify-between border-b border-zinc-200 mb-8">
          <div className="flex items-center gap-8">
            <button
              onClick={() => setActiveTab('active')}
              className={`text-xs font-mono font-medium pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 uppercase tracking-widest ${
                activeTab === 'active'
                  ? 'border-black text-black'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700'
              }`}
            >
              <span>Settlement Records</span>
              <span className="px-2 py-0.5 rounded text-[9px] bg-zinc-100 text-zinc-700 font-mono border border-zinc-200">
                {negotiations.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('opportunities')}
              className={`text-xs font-mono font-medium pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 uppercase tracking-widest ${
                activeTab === 'opportunities'
                  ? 'border-black text-black'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700'
              }`}
            >
              <span>AI Detected Invoices</span>
              <span className="px-2 py-0.5 rounded text-[9px] bg-zinc-100 text-zinc-900 border border-zinc-300 font-mono font-semibold">
                {detectedOpportunities.length} Ready
              </span>
            </button>
          </div>
        </div>

        {/* AI Detected Opportunities Tab */}
        {activeTab === 'opportunities' && (
          <div className="space-y-4 mb-8">
            {detectedOpportunities.map((opp) => (
              <div
                key={opp.id}
                className="bg-white rounded-xl border border-zinc-200 p-6 hover:border-zinc-400 transition-all shadow-2xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-zinc-950 font-mono">
                        {opp.invoiceNumber}
                      </span>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 uppercase tracking-wider">
                        {opp.detectionType.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {opp.sourceSystem}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-700">
                      Counterparty: <strong className="text-zinc-950 font-semibold">{opp.counterpartyName}</strong> ({opp.counterpartyCode}) • Amount: <strong className="text-zinc-950 font-mono">€{opp.amount.toLocaleString()} {opp.currency}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAutoInitiate(opp)}
                    disabled={autoInitiatingId === opp.id}
                    className="px-6 py-3 bg-black hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <span>{autoInitiatingId === opp.id ? 'Auto-Executing...' : '⚡ Auto-Initiate Handslag'}</span>
                  </button>
                </div>

                {/* Persistent Settlement Basis Drawer */}
                <SettlementBasisDrawer
                  amount={opp.amount}
                  currency={opp.currency}
                  invoiceNumber={opp.invoiceNumber}
                  sourceSystem={opp.sourceSystem}
                />
              </div>
            ))}
          </div>
        )}

        {/* Custom Create Negotiation Form Modal */}
        {showCreate && (
          <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-6 mb-8 shadow-xs">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-zinc-950 mb-4 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-zinc-600" />
              Initiate Custom Settlement Negotiation
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider block mb-1">Counterparty Code</label>
                <input
                  type="text"
                  value={createForm.counterpartyCode}
                  onChange={(e) => setCreateForm(f => ({ ...f, counterpartyCode: e.target.value.toUpperCase() }))}
                  placeholder="e.g. AURORA"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-zinc-300 text-xs font-mono text-zinc-950 focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider block mb-1">Invoice Number</label>
                <input
                  type="text"
                  value={createForm.invoiceNumber}
                  onChange={(e) => setCreateForm(f => ({ ...f, invoiceNumber: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-zinc-300 text-xs font-mono text-zinc-950 focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider block mb-1">Amount (€)</label>
                <input
                  type="number"
                  value={createForm.amount}
                  onChange={(e) => setCreateForm(f => ({ ...f, amount: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-zinc-300 text-xs font-mono text-zinc-950 focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider block mb-1">Currency</label>
                <input
                  type="text"
                  value={createForm.currency}
                  onChange={(e) => setCreateForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-zinc-300 text-xs font-mono text-zinc-950 focus:outline-none focus:border-black"
                />
              </div>
            </div>
            {createError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-mono mb-4">
                {createError}
              </div>
            )}
            <div className="flex gap-2.5">
              <button
                onClick={handleCreate}
                disabled={creating || !createForm.counterpartyCode}
                className="px-4 py-2 bg-black text-white hover:bg-zinc-800 rounded-lg text-xs font-semibold tracking-wider uppercase disabled:opacity-30 transition-all cursor-pointer shadow-xs"
              >
                {creating ? 'Executing...' : 'Execute Handslag'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 bg-white text-zinc-700 rounded-lg text-xs font-mono uppercase hover:bg-zinc-100 transition-colors cursor-pointer border border-zinc-200"
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
              <div className="text-center py-16 text-zinc-400 text-xs font-mono uppercase tracking-widest">Loading records...</div>
            ) : negotiations.length === 0 ? (
              <div className="bg-zinc-50 rounded-2xl border border-zinc-200 p-16 text-center shadow-2xs">
                <p className="text-xs font-mono text-zinc-600 mb-2 uppercase tracking-[0.2em]">No Active Negotiations</p>
                <p className="text-xs text-zinc-400 mb-8 font-mono">
                  Select an AI-detected invoice to run autonomous bilateral settlement.
                </p>
                <button
                  onClick={() => setActiveTab('opportunities')}
                  className="px-5 py-2.5 bg-black hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <span>View {detectedOpportunities.length} Detected Invoices</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {negotiations.map((n) => {
                  const stateInfo = STATE_COLORS[n.state] ?? STATE_COLORS.EVIDENCE_REQUESTED;
                  const awaitingHandshake = isAwaitingMyHandshake(n);
                  
                  return (
                    <button
                      key={n.id}
                      onClick={() => onSelectNegotiation(n.id)}
                      className={`w-full bg-white rounded-xl border p-5 text-left transition-all cursor-pointer hover:border-zinc-400 hover:shadow-sm group ${
                        awaitingHandshake
                          ? 'border-black ring-2 ring-zinc-900/10'
                          : 'border-zinc-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[9px] font-mono font-medium text-zinc-400 uppercase">{n.myRole}</span>
                            <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700">
                              <Building2 className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2.5 mb-1">
                              <span className="text-xs font-bold text-zinc-950 font-mono">{n.invoiceId}</span>
                              <span className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded border ${stateInfo.bg} ${stateInfo.text}`}>
                                {stateInfo.label}
                              </span>
                              {awaitingHandshake && (
                                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-black text-white flex items-center gap-1">
                                  1-CLICK APPROVAL READY
                                </span>
                              )}
                              {n.state === 'COMPLETED' && (
                                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-900 border border-zinc-300 flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5 text-zinc-900" />
                                  SETTLED
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-500 font-mono">
                              {n.myRole === 'SUPPLIER' ? `→ ${n.buyerOrg}` : `← ${n.supplierOrg}`}
                              <span className="mx-2">•</span>
                              <span>{n.claimCount} claims</span>
                              <span className="mx-1">·</span>
                              <span>{n.proposalCount} proposals</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right text-[10px] text-zinc-400 font-mono">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {new Date(n.updatedAt).toLocaleTimeString()}
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-black transition-transform group-hover:translate-x-0.5" />
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
