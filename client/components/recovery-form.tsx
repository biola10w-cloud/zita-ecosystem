'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Brand } from './app-nav';

export function RecoveryForm({ reset = false }: { reset?: boolean }) {
  const token = useSearchParams().get('token');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true); setError('');
    try {
      const response = await fetch('/api/auth/recovery', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: reset ? 'reset' : 'forgot', email: form.get('email'), password: form.get('password'), token }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? 'Please try again.');
      setDone(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to connect.'); }
    finally { setPending(false); }
  }
  return <main className="auth-page"><Brand /><section className="auth-panel"><h1>{reset ? 'A fresh start.' : 'Forgot your password?'}</h1>
    {done ? <p role="status" className="auth-copy">{reset ? 'Your password has been updated. Sign in with your new password.' : 'If an account exists for that email, you’ll receive a password reset link.'}</p>
      : reset && !token ? <p role="alert">This reset link is incomplete. Request a new link.</p>
      : <form className="auth-form" onSubmit={submit}><p className="auth-copy">{reset ? 'Choose a new password of at least eight characters.' : 'Enter your email to request a reset link.'}</p>
        {reset ? <label>New password<input type="password" name="password" minLength={8} maxLength={128} autoComplete="new-password" required /></label> : <label>Email<input type="email" name="email" autoComplete="email" required /></label>}
        {error && <p role="alert" className="form-error">{error}</p>}<button className="button button-dark" disabled={pending}>{pending ? 'Working…' : reset ? 'Update password' : 'Send reset link'}</button></form>}
    <p><Link className="text-link" href={reset && !token ? '/forgot-password' : '/login'}>{reset && !token ? 'Request a new link' : 'Back to sign in'}</Link></p></section></main>;
}
