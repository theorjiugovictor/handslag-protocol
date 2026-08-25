'use client';

import { useState } from 'react';
import { Building2, ArrowRight, ArrowLeft } from 'lucide-react';
import { useSession } from './SessionProvider';

const DEMO_COMPANIES = [
  { code: 'NORDIC', name: 'Nordic Components AB', org: '556789-0123', desc: 'Component Manufacturer (Creditor / Seller)' },
  { code: 'AURORA', name: 'Aurora Retail AB', org: '559123-4568', desc: 'Retail Distribution Network (Debtor / Buyer)' },
  { code: 'STELLAR', name: 'Stellar Logistics AB', org: '558456-7890', desc: 'Logistics & Supply Chain Partner' },
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
    <div className="min-h-screen bg-white text-zinc-950 flex items-center justify-center p-6 relative font-sans antialiased bg-grid-light">
      {onBackToLanding && (
        <button
          onClick={onBackToLanding}
          className="absolute top-8 left-8 text-xs font-mono text-zinc-500 hover:text-black border border-zinc-200 hover:border-zinc-400 px-3.5 py-2 rounded-lg bg-white shadow-2xs transition-all cursor-pointer flex items-center gap-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Home</span>
        </button>
      )}

      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-black text-white mb-4 shadow-sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 12L10 6L14 10L20 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 20L10 14L14 18L20 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-xl font-light text-zinc-950 tracking-tight">Select Enterprise Identity</h1>
          <p className="text-xs text-zinc-500 mt-2 font-normal leading-relaxed">
            Choose an organization to participate in bilateral settlement negotiations.
          </p>
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
              className={`w-full p-4 rounded-xl border text-left transition-all cursor-pointer group ${
                selectedCode === company.code && loading
                  ? 'border-black bg-zinc-50 text-black shadow-2xs'
                  : 'bg-white border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50/70 shadow-2xs'
              } disabled:opacity-60`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5 text-zinc-700" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-950 tracking-tight">
                      {company.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      {company.org} • {company.desc}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                    {company.code}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-black transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Custom Code Input */}
        <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4">
          <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-2">
            Custom Organization Code
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
              placeholder="ENTERPRISE_CODE"
              className="flex-1 px-3 py-2 rounded-lg bg-white border border-zinc-300 text-xs font-mono text-zinc-950 focus:outline-none focus:border-black tracking-wider"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customCode) handleLogin(customCode);
              }}
            />
            <button
              onClick={() => customCode && handleLogin(customCode)}
              disabled={!customCode || loading}
              className="px-4 py-2 bg-black text-white hover:bg-zinc-800 rounded-lg text-xs font-semibold disabled:opacity-30 transition-all cursor-pointer shadow-xs"
            >
              Enter
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-mono">
            {error}
          </div>
        )}

        <p className="text-center text-[10px] text-zinc-400 font-mono mt-8">
          Open a second browser tab or window to transact in real time.
        </p>
      </div>
    </div>
  );
}
