'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { readerRequest } from '../lib/browser-api';

export function DeleteAccountForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleted, setDeleted] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setError('');
    try {
      await readerRequest('/api/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: data.get('password'), confirmation: 'DELETE' }) });
      form.reset(); setDeleted(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to delete your account. Please try again.'); }
    finally { setBusy(false); }
  }
  if (deleted) return <div role="status"><p>Your Zita account has been deleted.</p><Link href="/">Back to the library</Link></div>;
  return <form className="auth-form" onSubmit={submit}>
    <label>Current password<input name="password" type="password" autoComplete="current-password" maxLength={128} required disabled={busy} /></label>
    <label><input name="confirm" type="checkbox" required disabled={busy} /> I understand this permanently deletes my account.</label>
    {error && <p role="alert">{error}</p>}
    <button className="button button-dark" disabled={busy}>{busy ? 'Deleting…' : 'Permanently delete account'}</button>
  </form>;
}
