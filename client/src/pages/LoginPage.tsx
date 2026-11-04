import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight, UserCheck, ExternalLink, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState<string>('admin@nexus.com');
  const [password, setPassword] = useState<string>('Password123!');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setDemoRole = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('Password123!');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#090909] text-white flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background radial ambient orange glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-[#ff5a1f]/15 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-white/5 blur-[120px] pointer-events-none rounded-full" />

      {/* Subtle architectural grid */}
      <div 
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />

      {/* Top Portfolio Badge */}
      <header className="relative z-10 max-w-md mx-auto w-full flex items-center justify-between">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 font-mono text-[10px] uppercase tracking-wider text-slate-300">
          <span className="w-2 h-2 rounded-full bg-[#ff5a1f] shadow-[0_0_0_4px_rgba(255,90,31,0.2)] animate-pulse" />
          <span>K. A. Dulanjan Anushika</span>
        </div>
        <a
          href="https://dulanjan-modern-portfolio.vercel.app/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-400 hover:text-[#ff5a1f] transition"
        >
          <span>Portfolio</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </header>

      {/* Center Card */}
      <main className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 my-auto py-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center space-x-3 mb-3">
            <div className="w-11 h-11 rounded-[9px_3px_9px_3px] -rotate-3 bg-[#0c0c0d] border border-white/20 flex items-center justify-center text-white font-black text-xl shadow-2xl">
              N
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-black tracking-[-0.04em] text-white">
                NEXUS <span className="text-[#ff5a1f]">HRMS</span>
                <span className="font-mono text-[8px] text-[#ff5a1f] ml-1 align-top">®</span>
              </h1>
              <p className="text-[11px] font-mono text-slate-400 uppercase tracking-widest">
                Sri Lankan Statutory Suite
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#121214]/90 backdrop-blur-xl py-7 px-6 shadow-2xl rounded-3xl sm:px-8 border border-white/10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-white tracking-tight">Enterprise Access</h2>
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#ff5a1f] bg-[#ff5a1f]/10 border border-[#ff5a1f]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Production v1.0</span>
            </span>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#090909] border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#ff5a1f] focus:ring-1 focus:ring-[#ff5a1f] transition font-mono"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#090909] border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#ff5a1f] focus:ring-1 focus:ring-[#ff5a1f] transition font-mono"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-[#ff5a1f] hover:bg-[#eb3e00] text-white font-mono text-xs uppercase tracking-wider py-3 px-4 rounded-full shadow-lg shadow-[#ff5a1f]/25 transition hover:-translate-y-0.5 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick Demo Role Switcher */}
          <div className="mt-6 pt-5 border-t border-white/10">
            <div className="font-mono text-[9px] uppercase tracking-widest text-slate-400 mb-2.5 flex items-center space-x-1.5">
              <UserCheck className="w-3 h-3 text-[#ff5a1f]" />
              <span>1-Click Demo Profiles</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDemoRole('admin@nexus.com')}
                className={`p-2 rounded-xl border text-left transition ${
                  email === 'admin@nexus.com'
                    ? 'border-[#ff5a1f] bg-[#ff5a1f]/10 text-white'
                    : 'border-white/5 bg-white/[0.02] text-slate-400 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <div className="font-bold text-xs">Super Admin</div>
                <div className="text-[10px] font-mono text-slate-500 truncate">admin@nexus.com</div>
              </button>

              <button
                type="button"
                onClick={() => setDemoRole('hr@nexus.com')}
                className={`p-2 rounded-xl border text-left transition ${
                  email === 'hr@nexus.com'
                    ? 'border-[#ff5a1f] bg-[#ff5a1f]/10 text-white'
                    : 'border-white/5 bg-white/[0.02] text-slate-400 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <div className="font-bold text-xs">HR Manager</div>
                <div className="text-[10px] font-mono text-slate-500 truncate">hr@nexus.com</div>
              </button>

              <button
                type="button"
                onClick={() => setDemoRole('manager@nexus.com')}
                className={`p-2 rounded-xl border text-left transition ${
                  email === 'manager@nexus.com'
                    ? 'border-[#ff5a1f] bg-[#ff5a1f]/10 text-white'
                    : 'border-white/5 bg-white/[0.02] text-slate-400 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <div className="font-bold text-xs">Line Manager</div>
                <div className="text-[10px] font-mono text-slate-500 truncate">manager@nexus.com</div>
              </button>

              <button
                type="button"
                onClick={() => setDemoRole('kasun.p@nexus.com')}
                className={`p-2 rounded-xl border text-left transition ${
                  email === 'kasun.p@nexus.com'
                    ? 'border-[#ff5a1f] bg-[#ff5a1f]/10 text-white'
                    : 'border-white/5 bg-white/[0.02] text-slate-400 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <div className="font-bold text-xs">Employee</div>
                <div className="text-[10px] font-mono text-slate-500 truncate">kasun.p@nexus.com</div>
              </button>
            </div>
            <div className="mt-3 text-[10px] font-mono text-slate-400 text-center">
              Universal Password: <span className="text-[#ff5a1f] font-bold">Password123!</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center font-mono text-[10px] text-slate-500 uppercase tracking-widest">
        <span>Architected by K. A. Dulanjan Anushika • </span>
        <span className="text-slate-400">EPF / ETF / APIT / Gratuity Compliant</span>
      </footer>
    </div>
  );
};
