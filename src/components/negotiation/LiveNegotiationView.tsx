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
  Check,
  X,
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-xs font-mono text-zinc-400">Loading negotiation state...</div>
      </div>
    );
  }

  const isSupplier = negotiation.myRole === 'SUPPLIER';
  const counterparty = isSupplier ? negotiation.buyerOrg : negotiation.supplierOrg;
  const myOrg = isSupplier ? negotiation.supplierOrg : negotiation.buyerOrg;
  
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
    <div className="min-h-screen bg-white text-zinc-950 selection:bg-black selection:text-white font-sans antialiased bg-grid-light">
      {/* Header */}
      <header className="bg-white/90 border-b border-zinc-200 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-lg text-zinc-500 hover:text-black hover:bg-zinc-100 transition-colors cursor-pointer border border-zinc-200"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-zinc-950 text-sm font-mono">{negotiation.invoiceId}</span>
                <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                  negotiation.state === 'COMPLETED'
                    ? 'bg-black text-white border-black'
                    : 'bg-zinc-100 text-zinc-900 border-zinc-300'
                }`}>
                  {negotiation.state.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-50 text-zinc-600 border border-zinc-200 inline-flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-black animate-pulse' : 'bg-zinc-400'}`}></span>
                  {connected ? 'LIVE' : 'OFFLINE'}
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                {myOrg.name} ({negotiation.myRole}) → {counterparty.name}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-800 border border-zinc-200">
              <Building2 className="w-3.5 h-3.5 inline mr-1 text-zinc-600" />
              {isSupplier ? 'Role: Supplier' : 'Role: Buyer'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 pt-8 pb-20">
        {/* Settlement Success Receipt if Completed */}
        {negotiation.state === 'COMPLETED' && (
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-7 mb-8 shadow-2xs">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-950 uppercase tracking-wider font-mono">
                    Autonomous Settlement Completed
                  </h2>
                  <span className="text-xs text-zinc-500 font-mono">
                    Bilateral Handslag verified & executed via SEPA Instant
                  </span>
                </div>
              </div>
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-black text-white">
                SETTLED
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-zinc-200 text-xs font-mono">
              <div>
                <span className="text-[10px] text-zinc-400 uppercase">Immediate Tranche</span>
                <span className="text-sm font-bold text-zinc-950 mt-1 block">€4,000.00 EUR</span>
                <span className="text-[10px] text-zinc-500">SEPA Instant Executed</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 uppercase">Scheduled Tranche</span>
                <span className="text-sm font-bold text-zinc-950 mt-1 block">€6,000.00 EUR</span>
                <span className="text-[10px] text-zinc-500">Day 14 Auto-Release</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 uppercase">Policy Firewall</span>
                <span className="text-sm font-bold text-zinc-950 mt-1 block">12/12 Rules Passed</span>
                <span className="text-[10px] text-zinc-500">Deterministic Mandate</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 uppercase">Double-Financing Lien</span>
                <span className="text-sm font-bold text-zinc-950 mt-1 block">Released & Logged</span>
                <span className="text-[10px] text-zinc-500">TransCare Shield</span>
              </div>
            </div>
          </div>
        )}

        {/* Party Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 mb-6">
          <div className={`lg:col-span-5 bg-white rounded-xl border p-5 ${
            isSupplier ? 'border-black shadow-2xs' : 'border-zinc-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-zinc-600" />
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                Supplier {isSupplier ? '(You)' : ''}
              </span>
            </div>
            <div className="text-sm font-bold text-zinc-950">{negotiation.supplierOrg.name}</div>
            <div className="text-[11px] text-zinc-500 font-mono mt-0.5">{negotiation.supplierOrg.orgNumber}</div>
          </div>

          <div className="lg:col-span-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-1">
              <Network className="w-4 h-4 text-zinc-400" />
              <div className="w-px h-4 bg-zinc-200"></div>
              <Lock className="w-3.5 h-3.5 text-zinc-500" />
            </div>
          </div>

          <div className={`lg:col-span-5 bg-white rounded-xl border p-5 ${
            !isSupplier ? 'border-black shadow-2xs' : 'border-zinc-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-zinc-600" />
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                Buyer {!isSupplier ? '(You)' : ''}
              </span>
            </div>
            <div className="text-sm font-bold text-zinc-950">{negotiation.buyerOrg.name}</div>
            <div className="text-[11px] text-zinc-500 font-mono mt-0.5">{negotiation.buyerOrg.orgNumber}</div>
          </div>
        </div>

        {/* Action Bar (shown only if manual action required) */}
        {!isTerminal && (canMatchPayable || canPropose || canAcceptOrReject) && (
          <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-zinc-600" />
              <span className="text-xs font-mono text-zinc-800">
                {canMatchPayable && 'MANUAL ACTION: Match payable against your AP ledger'}
                {canPropose && (isSupplier ? 'ACTION: Propose terms' : 'ACTION: Review proposal or submit counteroffer')}
                {canAcceptOrReject && 'ACTION: Accept or counter latest proposal'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {canMatchPayable && (
                <button
                  onClick={() => handleAction('MATCH_PAYABLE')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-black text-white rounded-lg text-xs font-semibold hover:bg-zinc-800 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Confirm Match
                </button>
              )}

              {canPropose && (
                <button
                  onClick={() => setShowProposalForm(true)}
                  className="px-4 py-2 bg-black text-white rounded-lg text-xs font-semibold hover:bg-zinc-800 transition-colors cursor-pointer flex items-center gap-1.5"
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
                    className="px-4 py-2 bg-black text-white rounded-lg text-xs font-semibold hover:bg-zinc-800 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Accept Deal
                  </button>
                  <button
                    onClick={() => setShowProposalForm(true)}
                    className="px-4 py-2 bg-white text-zinc-800 border border-zinc-300 rounded-lg text-xs font-semibold hover:bg-zinc-50 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Counter
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-4 border-b border-zinc-200 mb-6">
          {(['claims', 'proposals', 'audit'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-xs font-mono font-medium pb-3 border-b-2 transition-colors cursor-pointer uppercase ${
                activeTab === tab
                  ? 'border-black text-black'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700'
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
          <div className="space-y-2.5">
            {negotiation.claims.map((claim, idx) => (
              <div
                key={claim.id}
                onClick={() => setSelectedClaim(claim)}
                className="bg-white rounded-xl border border-zinc-200 p-4 transition-all cursor-pointer hover:border-zinc-400 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-zinc-100 text-zinc-700 font-mono font-medium text-xs flex items-center justify-center border border-zinc-200">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-zinc-950">{claim.issuerOrganization}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">{claim.claimType}</span>
                        <span className="text-[10px] font-mono text-zinc-600 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded">
                          {claim.verificationStatus}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono">
                        Source: {claim.sourceSystem} • Hash: {claim.evidenceHash.slice(0, 20)}...
                      </div>
                    </div>
                  </div>
                  <button className="text-xs text-zinc-500 hover:text-black flex items-center gap-1 font-mono">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Payload</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Proposals Tab */}
        {activeTab === 'proposals' && (
          <div className="space-y-3">
            {negotiation.proposals.map((proposal) => (
              <div key={proposal.id} className="bg-white rounded-xl border border-zinc-200 p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                      {proposal.proposerRole}
                    </span>
                    <span className="text-xs font-bold text-zinc-950 font-mono">
                      Round #{proposal.sequenceNumber}
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-black text-white">
                      {proposal.status}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {new Date(proposal.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {proposal.installments.map((inst: { amount: number; currency: string; executionDate: string; label: string }, i: number) => (
                    <div key={i} className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                      <div className="text-[10px] font-mono text-zinc-500 mb-0.5 uppercase">{inst.label}</div>
                      <div className="text-sm font-bold text-zinc-950 font-mono">€{inst.amount.toLocaleString()} {inst.currency}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">{inst.executionDate}</div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-3 text-xs text-zinc-600 font-mono">
                  Total Settled: <span className="font-bold text-zinc-950">€{proposal.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden font-mono shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 text-[10px] font-semibold uppercase">
                <tr>
                  <th className="py-2.5 px-4">Time</th>
                  <th className="py-2.5 px-4">Actor</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">State Transition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {negotiation.auditLog.map((e) => (
                  <tr key={e.id} className="hover:bg-zinc-50/50">
                    <td className="py-2.5 px-4 text-zinc-400 text-[11px]">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-zinc-950">{e.actor}</td>
                    <td className="py-2.5 px-4 text-zinc-600">{e.action}</td>
                    <td className="py-2.5 px-4">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-200">
                        {e.stateTransition || '—'}
                      </span>
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-zinc-200 font-mono">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">CRYPTOGRAPHIC CLAIM ENVELOPE</span>
                <h3 className="text-sm font-bold text-zinc-950 mt-0.5">{selectedClaim.claimType}</h3>
              </div>
              <button onClick={() => setSelectedClaim(null)} className="text-zinc-400 hover:text-black p-1 rounded-lg text-xs cursor-pointer">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 font-mono">
                <span className="text-zinc-500 text-[10px]">Evidence Hash (SHA-512):</span>
                <div className="text-zinc-900 break-all text-[11px] mt-0.5">{selectedClaim.evidenceHash}</div>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] mb-1 block">Payload Envelope:</span>
                <pre className="bg-zinc-900 text-zinc-100 p-3 rounded-lg overflow-auto max-h-56 font-mono text-[11px]">
                  {JSON.stringify(selectedClaim.payload, null, 2)}
                </pre>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setSelectedClaim(null)} className="px-4 py-2 bg-black text-white rounded-lg text-xs font-semibold hover:bg-zinc-800 cursor-pointer shadow-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
