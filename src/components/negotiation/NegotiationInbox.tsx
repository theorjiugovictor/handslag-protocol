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
} from 'lucide-react';
import { useSession } from '../auth/SessionProvider';
import { useNegotiationList, type NegotiationSummary } from '../realtime/useNegotiation';
import { useEventSource } from '../realtime/useEventSource';

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
  COMPLETED: { bg: 'bg-slate-900', text: 'text-white', label: 'Completed' },
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
  const [createForm, setCreateForm] = useState({
    counterpartyCode: '',
    invoiceNumber: `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    amount: 10000,
    currency: 'EUR',
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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

  const needsMyAction = (n: NegotiationSummary) => {
    if (n.myRole === 'BUYER' && n.state === 'SUPPLIER_EVIDENCE_PRESENTED') return true;
    if (n.myRole === 'BUYER' && n.state === 'INITIAL_PROPOSAL') return true;
    if (n.myRole === 'SUPPLIER' && n.state === 'COUNTERPROPOSAL') return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-semibold text-sm">
                🤝
              </div>
              <div>
                <span className="font-bold text-slate-900 text-sm tracking-tight">Handslag Protocol</span>
                <span className="ml-2 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                  {connected ? 'LIVE' : 'CONNECTING'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              <Building2 className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-xs font-bold text-slate-900">{session?.organizationName}</span>
              <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                {session?.companyCode}
              </span>
            </div>
            <button
              onClick={onStartSoloDemo}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Solo Demo
            </button>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-16">
        {/* Page Title + Actions */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Negotiations</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Active and completed settlement negotiations for {session?.organizationName}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Settlement
          </button>
        </div>

        {/* Create Negotiation Form */}
        {showCreate && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm animate-fadeIn">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              Initiate Settlement Negotiation
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">Counterparty Code</label>
                <input
                  type="text"
                  value={createForm.counterpartyCode}
                  onChange={(e) => setCreateForm(f => ({ ...f, counterpartyCode: e.target.value.toUpperCase() }))}
                  placeholder="e.g. AURORA"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-slate-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">Invoice Number</label>
                <input
                  type="text"
                  value={createForm.invoiceNumber}
                  onChange={(e) => setCreateForm(f => ({ ...f, invoiceNumber: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-slate-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">Amount (€)</label>
                <input
                  type="number"
                  value={createForm.amount}
                  onChange={(e) => setCreateForm(f => ({ ...f, amount: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-slate-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">Currency</label>
                <input
                  type="text"
                  value={createForm.currency}
                  onChange={(e) => setCreateForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-slate-500"
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
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
              >
                {creating ? 'Creating...' : 'Create & Present Invoice Claim'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Negotiation List */}
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Loading negotiations...</div>
        ) : negotiations.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Network className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-1">No negotiations yet</p>
            <p className="text-xs text-slate-400">
              Create a new settlement or wait for a counterparty to initiate one.
            </p>
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
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] font-medium text-slate-400 uppercase">{n.myRole}</span>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          n.myRole === 'SUPPLIER' ? 'bg-indigo-100 text-indigo-700' : 'bg-sky-100 text-sky-700'
                        }`}>
                          <Building2 className="w-4 h-4" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-bold text-slate-900">{n.invoiceId}</span>
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
                        <div className="text-xs text-slate-500">
                          {n.myRole === 'SUPPLIER' ? `→ ${n.buyerOrg}` : `← ${n.supplierOrg}`}
                          <span className="mx-2">•</span>
                          <span className="font-mono">{n.claimCount} claims</span>
                          <span className="mx-1">·</span>
                          <span className="font-mono">{n.proposalCount} proposals</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right text-xs text-slate-400">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {new Date(n.updatedAt).toLocaleTimeString()}
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
