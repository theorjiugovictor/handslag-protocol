'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Send,
  Lock,
  Activity,
  Clock,
  Eye,
  Network,
  Download,
} from 'lucide-react';
import { useSession } from '../auth/SessionProvider';
import { useNegotiation, type NegotiationDetail } from '../realtime/useNegotiation';
import { useEventSource } from '../realtime/useEventSource';

interface LiveNegotiationViewProps {
  negotiationId: string;
  onBack: () => void;
}

export default function LiveNegotiationView({ negotiationId, onBack }: LiveNegotiationViewProps) {
  const { session } = useSession();
  const { negotiation, loading, performAction } = useNegotiation(negotiationId);
  const { connected } = useEventSource(true);
  const [activeTab, setActiveTab] = useState<'claims' | 'proposals' | 'audit'>('claims');
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [proposalAmount, setProposalAmount] = useState(0);
  const [proposalScheduledAmount, setProposalScheduledAmount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<NegotiationDetail['claims'][0] | null>(null);

  if (loading || !negotiation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500">Loading negotiation...</div>
      </div>
    );
  }

  const isSupplier = negotiation.myRole === 'SUPPLIER';
  const counterparty = isSupplier ? negotiation.buyerOrg : negotiation.supplierOrg;
  const myOrg = isSupplier ? negotiation.supplierOrg : negotiation.buyerOrg;
  
  // Determine what actions I can take
  const canMatchPayable = !isSupplier && negotiation.state === 'SUPPLIER_EVIDENCE_PRESENTED';
  const canPropose = (
    (isSupplier && negotiation.state === 'OBLIGATION_VERIFIED') ||
    (!isSupplier && negotiation.state === 'INITIAL_PROPOSAL')
  );
  const canAcceptOrReject = (
    (isSupplier && (negotiation.state === 'COUNTERPROPOSAL')) ||
    (!isSupplier && (negotiation.state === 'INITIAL_PROPOSAL'))
  );
  const isTerminal = ['COMPLETED', 'REJECTED', 'ESCALATED'].includes(negotiation.state);

  const handleAction = async (action: 'MATCH_PAYABLE' | 'PROPOSE' | 'COUNTER' | 'ACCEPT' | 'REJECT', payload?: Record<string, unknown>) => {
    setActionLoading(true);
    await performAction(action, payload);
    setActionLoading(false);
    setShowProposalForm(false);
  };

  const latestProposal = negotiation.proposals
    .filter(p => p.status === 'PENDING')
    .sort((a, b) => b.sequenceNumber - a.sequenceNumber)[0];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">{negotiation.invoiceId}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  isTerminal
                    ? negotiation.state === 'COMPLETED'
                      ? 'bg-slate-900 text-white'
                      : 'bg-rose-100 text-rose-800'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  {negotiation.state.replace(/_/g, ' ')}
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                  connected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                  {connected ? 'LIVE' : 'OFFLINE'}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {myOrg.name} ({negotiation.myRole}) → {counterparty.name}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
              isSupplier ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-sky-50 text-sky-700 border border-sky-200'
            }`}>
              <Building2 className="w-3.5 h-3.5 inline mr-1" />
              {isSupplier ? 'Supplier' : 'Buyer'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-6 pb-16">
        {/* Party Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 mb-6">
          <div className={`lg:col-span-5 bg-white rounded-xl border p-5 ${
            isSupplier ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                Supplier {isSupplier ? '(You)' : ''}
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900">{negotiation.supplierOrg.name}</div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">{negotiation.supplierOrg.orgNumber}</div>
          </div>

          <div className="lg:col-span-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-1">
              <Network className="w-4 h-4 text-slate-400" />
              <div className="w-px h-4 bg-slate-300"></div>
              <Lock className="w-3 h-3 text-emerald-500" />
            </div>
          </div>

          <div className={`lg:col-span-5 bg-white rounded-xl border p-5 ${
            !isSupplier ? 'border-sky-300 ring-2 ring-sky-100' : 'border-slate-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-sky-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-sky-700">
                Buyer {!isSupplier ? '(You)' : ''}
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900">{negotiation.buyerOrg.name}</div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">{negotiation.buyerOrg.orgNumber}</div>
          </div>
        </div>

        {/* Action Bar */}
        {!isTerminal && (
          <div className="bg-white rounded-xl border border-amber-200 p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold text-slate-900">
                {canMatchPayable && 'Action Required: Verify and match this payable against your records'}
                {canPropose && (isSupplier ? 'Your turn: Propose settlement terms' : 'Your turn: Review proposal or counter')}
                {canAcceptOrReject && 'Your turn: Accept or counter the latest proposal'}
                {!canMatchPayable && !canPropose && !canAcceptOrReject && `Waiting for ${counterparty.name} to respond...`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {canMatchPayable && (
                <button
                  onClick={() => handleAction('MATCH_PAYABLE')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Confirm Payable Match
                </button>
              )}

              {canPropose && (
                <button
                  onClick={() => setShowProposalForm(true)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSupplier ? 'Propose Terms' : 'Counter Proposal'}
                </button>
              )}

              {canAcceptOrReject && latestProposal && (
                <>
                  <button
                    onClick={() => handleAction('ACCEPT')}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Accept
                  </button>
                  <button
                    onClick={() => setShowProposalForm(true)}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Counter
                  </button>
                  <button
                    onClick={() => handleAction('REJECT', { reason: 'Unacceptable terms' })}
                    disabled={actionLoading}
                    className="px-3 py-2 bg-white border border-rose-300 text-rose-600 rounded-lg text-xs font-semibold hover:bg-rose-50 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Proposal Form */}
        {showProposalForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm animate-fadeIn">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Settlement Proposal</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">Immediate Payment (€)</label>
                <input
                  type="number"
                  value={proposalAmount}
                  onChange={(e) => setProposalAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-slate-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">Scheduled Payment (€, optional)</label>
                <input
                  type="number"
                  value={proposalScheduledAmount}
                  onChange={(e) => setProposalScheduledAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-slate-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const installments = [
                    { amount: proposalAmount, currency: 'EUR', executionDate: new Date().toISOString().split('T')[0], label: 'Immediate' },
                  ];
                  if (proposalScheduledAmount > 0) {
                    const d = new Date();
                    d.setDate(d.getDate() + 14);
                    installments.push({
                      amount: proposalScheduledAmount,
                      currency: 'EUR',
                      executionDate: d.toISOString().split('T')[0],
                      label: 'Scheduled',
                    });
                  }
                  const actionType = canPropose ? (isSupplier ? 'PROPOSE' : 'COUNTER') : 'COUNTER';
                  handleAction(actionType as 'PROPOSE' | 'COUNTER', { installments });
                }}
                disabled={actionLoading || proposalAmount <= 0}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Submit Proposal
              </button>
              <button
                onClick={() => setShowProposalForm(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-4 border-b border-slate-200 mb-6">
          {(['claims', 'proposals', 'audit'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-xs font-bold pb-3 border-b-2 transition-colors cursor-pointer capitalize ${
                activeTab === tab
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab === 'claims' ? `Claims (${negotiation.claims.length})` :
               tab === 'proposals' ? `Proposals (${negotiation.proposals.length})` :
               `Audit Log (${negotiation.auditLog.length})`}
            </button>
          ))}
        </div>

        {/* Claims Tab */}
        {activeTab === 'claims' && (
          <div className="space-y-3">
            {negotiation.claims.map((claim, idx) => (
              <div
                key={claim.id}
                onClick={() => setSelectedClaim(claim)}
                className={`bg-white rounded-xl border p-4 transition-all cursor-pointer hover:shadow-sm ${
                  idx === negotiation.claims.length - 1 ? 'border-slate-900 ring-2 ring-slate-900/5' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center">{idx + 1}</span>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-slate-900">{claim.issuerOrganization}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">{claim.claimType}</span>
                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          ✓ {claim.verificationStatus}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Source: {claim.sourceSystem} • Hash: {claim.evidenceHash.slice(0, 20)}...
                      </div>
                    </div>
                  </div>
                  <button className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    Payload
                  </button>
                </div>
              </div>
            ))}
            {negotiation.claims.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400">
                No claims exchanged yet.
              </div>
            )}
          </div>
        )}

        {/* Proposals Tab */}
        {activeTab === 'proposals' && (
          <div className="space-y-3">
            {negotiation.proposals.map((proposal) => (
              <div key={proposal.id} className={`bg-white rounded-xl border p-5 ${
                proposal.status === 'PENDING' ? 'border-amber-300' :
                proposal.status === 'ACCEPTED' ? 'border-emerald-300' :
                'border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      proposal.proposerRole === 'SUPPLIER' ? 'bg-indigo-50 text-indigo-700' : 'bg-sky-50 text-sky-700'
                    }`}>
                      {proposal.proposerRole}
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      Round #{proposal.sequenceNumber}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      proposal.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                      proposal.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800' :
                      proposal.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {proposal.status}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(proposal.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {proposal.installments.map((inst: { amount: number; currency: string; executionDate: string; label: string }, i: number) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-[10px] text-slate-500 mb-0.5">{inst.label}</div>
                      <div className="text-sm font-bold text-slate-900">€{inst.amount.toLocaleString()} {inst.currency}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{inst.executionDate}</div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-3 text-xs text-slate-500">
                  Total: <span className="font-bold text-slate-900">€{proposal.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            ))}
            {negotiation.proposals.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400">
                No proposals yet. Obligation must be verified first.
              </div>
            )}
          </div>
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Time</th>
                  <th className="py-2.5 px-4">Actor</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Policy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {negotiation.auditLog.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{e.actor}</td>
                    <td className="py-2.5 px-4 text-slate-600">{e.action}</td>
                    <td className="py-2.5 px-4">
                      {e.policyDecision ? (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          e.policyDecision.startsWith('PASS') ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {e.policyDecision}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Claim Inspector Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cryptographic Claim Envelope</span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">{selectedClaim.claimType}</h3>
              </div>
              <button onClick={() => setSelectedClaim(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-sm cursor-pointer">✕</button>
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
              <button onClick={() => setSelectedClaim(null)} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
