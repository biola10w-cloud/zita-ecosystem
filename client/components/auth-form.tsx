'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';
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
      <Link href="/" className="brand"><BookOpen size={21} /> Zita</Link>
      <section className="auth-panel">
        <p className="eyebrow">Your reading space</p>
        <h1>{mode === 'signin' ? 'Welcome back.' : 'Start your library.'}</h1>
        <p className="auth-copy">{mode === 'signin' ? 'Sign in to continue reading and keep your progress in sync.' : 'Create an account to save your reading progress across sessions.'}</p>
        <div className="mode-switch" role="tablist" aria-label="Account action">
          <button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'selected' : ''} onClick={() => setMode('signin')}>Sign in</button>
          <button role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'selected' : ''} onClick={() => setMode('register')}>Create account</button>
        </div>
        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && <label>Display name<input name="displayName" minLength={2} maxLength={50} required autoComplete="name" /></label>}
          <label>Email<input name="email" type="email" required autoComplete="email" /></label>
          <label>Password<input name="password" type="password" minLength={8} required autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-dark full" disabled={loading}>{loading ? 'Working...' : mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight size={17} /></button>
        </form>
      </section>
    </main>
  );
}
