'use client';

import Link from 'next/link';
import { Brand } from './app-nav';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeReturnPath } from '../lib/navigation';

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeReturnPath(searchParams.get('next') || '/dashboard');
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/auth/${mode === 'signin' ? 'login' : 'register'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: form.get('displayName'),
        email: form.get('email'),
        password: form.get('password'),
      }),
    }).catch(() => null);
    const body = response ? await response.json().catch(() => null) : null;
    setLoading(false);
    if (!response?.ok) {
      setError(body?.error?.message ?? 'Unable to connect. Please try again.');
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <main className="auth-page">
      <Brand />
      <section className="auth-panel">
        <h1>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="auth-copy">{mode === 'signin' ? 'Sign in to continue reading' : 'Start your reading journey with Zita'}</p>
        <div className="mode-switch" role="tablist" aria-label="Account action">
          <button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'selected' : ''} onClick={() => setMode('signin')}>Sign in</button>
          <button role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'selected' : ''} onClick={() => setMode('register')}>Create account</button>
        </div>
        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && <label>Display name<input name="displayName" minLength={2} maxLength={50} required autoComplete="name" /></label>}
          <label><span className="sr-only">Email</span><input name="email" type="email" placeholder="Email address" required autoComplete="email" /></label>
          <label><span className="sr-only">Password</span><input name="password" type="password" placeholder="Password" minLength={8} required autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {mode === 'signin' && <Link className="forgot-link" href="/forgot-password">Forgot your password?</Link>}
          <button className="button button-dark full" disabled={loading}>{loading ? 'Working...' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        </form>
      </section>
    </main>
  );
}
