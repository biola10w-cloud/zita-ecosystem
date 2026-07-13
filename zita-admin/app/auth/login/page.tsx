'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { accessToken } = await api.auth.login(email, password);
      document.cookie = `zita_admin_token=${accessToken}; path=/; SameSite=Strict`;
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: '#1A1A2E' }}>

      {/* Glow orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10 blur-3xl"
        style={{ background: '#E8B84B', transform: 'translate(30%, -30%)' }} />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-10 blur-3xl"
        style={{ background: '#E8B84B', transform: 'translate(-30%, 30%)' }} />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center
            font-bold text-xl" style={{ background: '#E8B84B', color: '#1A1A2E' }}>
            Z
          </div>
          <div>
            <div className="font-bold text-xl tracking-widest text-white">ZITA</div>
            <div className="text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
              ADMIN PANEL
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-8"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Sign in to the admin dashboard
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-2 tracking-widest"
                style={{ color: 'rgba(255,255,255,0.5)' }}>
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@zita.app"
                className="w-full rounded-xl px-4 py-3 text-sm text-white
                  placeholder-white/30 focus:outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-2 tracking-widest"
                style={{ color: 'rgba(255,255,255,0.5)' }}>
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-xl px-4 py-3 text-sm text-white
                  placeholder-white/30 focus:outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>

            {error && (
              <div className="rounded-xl px-4 py-3 text-sm text-red-400"
                style={{ background: 'rgba(231,76,60,0.12)', border: '1px solid rgba(231,76,60,0.2)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full font-bold py-3 rounded-xl transition-all mt-2
                flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: '#E8B84B', color: '#1A1A2E' }}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'rgba(26,26,46,0.3)', borderTopColor: '#1A1A2E' }} />
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.2)' }}>
          ZITA Admin · Authorised personnel only
        </p>
      </div>
    </div>
  );
}
