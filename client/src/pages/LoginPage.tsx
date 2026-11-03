import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight, UserCheck } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-indigo-500/10 blur-[120px] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex items-center justify-center space-x-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-indigo-500/30">
            N
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              NEXUS <span className="text-indigo-400">HRMS</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">Enterprise Human Resource Suite</p>
          </div>
        </div>

        <div className="bg-slate-800/90 backdrop-blur-md py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-700/80">
          <h2 className="text-lg font-bold text-white mb-6">Sign in to your organization</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:shadow-indigo-500/20 transition flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Role Switcher */}
          <div className="mt-8 pt-6 border-t border-slate-700/60">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-1.5">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Select Demo Persona (Click to switch)</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDemoRole('admin@nexus.com')}
                className={`p-2 rounded-lg border text-left transition ${
                  email === 'admin@nexus.com'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                <div className="font-bold">Super Admin</div>
                <div className="text-[10px] text-slate-400 truncate">admin@nexus.com</div>
              </button>

              <button
                type="button"
                onClick={() => setDemoRole('hr@nexus.com')}
                className={`p-2 rounded-lg border text-left transition ${
                  email === 'hr@nexus.com'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                <div className="font-bold">HR Manager</div>
                <div className="text-[10px] text-slate-400 truncate">hr@nexus.com</div>
              </button>

              <button
                type="button"
                onClick={() => setDemoRole('manager@nexus.com')}
                className={`p-2 rounded-lg border text-left transition ${
                  email === 'manager@nexus.com'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                <div className="font-bold">Line Manager</div>
                <div className="text-[10px] text-slate-400 truncate">manager@nexus.com</div>
              </button>

              <button
                type="button"
                onClick={() => setDemoRole('dev@nexus.com')}
                className={`p-2 rounded-lg border text-left transition ${
                  email === 'dev@nexus.com'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                <div className="font-bold">Staff Engineer</div>
                <div className="text-[10px] text-slate-400 truncate">dev@nexus.com</div>
              </button>
            </div>
            <div className="mt-3 text-[11px] text-slate-400 text-center">
              All demo accounts password: <span className="text-indigo-300 font-mono">Password123!</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
