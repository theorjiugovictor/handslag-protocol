'use client';

import { useState } from 'react';
import { Building2, ArrowRight, Zap } from 'lucide-react';
import { useSession } from './SessionProvider';

const DEMO_COMPANIES = [
  { code: 'NORDIC', name: 'Nordic Components AB', org: '556789-0123', desc: 'Electronics supplier' },
  { code: 'AURORA', name: 'Aurora Retail AB', org: '559123-4568', desc: 'Retail chain buyer' },
  { code: 'STELLAR', name: 'Stellar Logistics AB', org: '558456-7890', desc: 'Logistics provider' },
];

interface LoginScreenProps {
  onBackToLanding?: () => void;
}

export default function LoginScreen({ onBackToLanding }: LoginScreenProps) {
  const { login } = useSession();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [customCode, setCustomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (code: string) => {
    setLoading(true);
    setError(null);
    const success = await login(code);
    if (!success) {
      setError(`Login failed for company code: ${code}`);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative">
      {onBackToLanding && (
        <button
          onClick={onBackToLanding}
          className="absolute top-6 left-6 text-xs font-semibold text-slate-500 hover:text-slate-900 bg-white border border-slate-200 px-3.5 py-2 rounded-xl shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-1.5"
        >
          ← Back to Handslag Home
        </button>
      )}

      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 text-white font-bold text-2xl mb-3 shadow-lg ring-1 ring-slate-800">
            🤝
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Handslag Protocol</h1>
          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
            Select your enterprise identity to enter the bilateral settlement network.
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              LIVE P2P SETTLEMENT
            </span>
          </div>
        </div>

        {/* Company Cards */}
        <div className="space-y-3 mb-6">
          {DEMO_COMPANIES.map((company) => (
            <button
              key={company.code}
              onClick={() => {
                setSelectedCode(company.code);
                handleLogin(company.code);
              }}
              disabled={loading}
              className={`w-full p-5 rounded-xl border text-left transition-all cursor-pointer group ${
                selectedCode === company.code && loading
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'bg-white border-slate-200 hover:border-slate-400 hover:shadow-md'
              } disabled:opacity-60`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    selectedCode === company.code && loading
                      ? 'bg-white/20'
                      : 'bg-slate-100'
                  }`}>
                    <Building2 className={`w-5 h-5 ${
                      selectedCode === company.code && loading ? 'text-white' : 'text-slate-600'
                    }`} />
                  </div>
                  <div>
                    <div className={`text-sm font-bold ${
                      selectedCode === company.code && loading ? 'text-white' : 'text-slate-900'
                    }`}>
                      {company.name}
                    </div>
                    <div className={`text-xs ${
                      selectedCode === company.code && loading ? 'text-slate-300' : 'text-slate-500'
                    }`}>
                      {company.org} • {company.desc}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    selectedCode === company.code && loading
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {company.code}
                  </span>
                  <ArrowRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
                    selectedCode === company.code && loading ? 'text-white' : 'text-slate-400'
                  }`} />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Custom Code Input */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <label className="text-xs font-medium text-slate-500 block mb-2">
            Or enter a custom company code:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
              placeholder="COMPANY_CODE"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customCode) handleLogin(customCode);
              }}
            />
            <button
              onClick={() => customCode && handleLogin(customCode)}
              disabled={!customCode || loading}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              Join
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
            {error}
          </div>
        )}

        {/* Footer hint */}
        <p className="text-center text-[11px] text-slate-400 mt-6">
          Open another browser tab and log in as a different company to negotiate in real-time.
        </p>
      </div>
    </div>
  );
}
