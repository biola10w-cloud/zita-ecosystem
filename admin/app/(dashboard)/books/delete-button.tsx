'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminRequest } from '../../../lib/browser-api';

export function DeleteButton({ bookId, title }: { bookId: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (!window.confirm(`Permanently delete “${title}”? This removes the book, its chapters, comments, purchases, and saved reading progress. This cannot be undone.`)) return;
    setBusy(true); setError('');
    try {
      const response = await adminRequest(`/api/books/${encodeURIComponent(bookId)}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message || 'Could not delete this book.');
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete this book.'); }
    finally { setBusy(false); }
  }
  return <span className="inline-flex flex-col items-end gap-1"><button type="button" onClick={remove} disabled={busy} aria-label={`Delete ${title}`} className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">{busy ? 'Deleting...' : 'Delete'}</button>{error && <span role="alert" className="max-w-xs text-xs text-red-600">{error}</span>}</span>;
}
