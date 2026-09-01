'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function PublishButton({ bookId, disabled }: { bookId: string; disabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/books/${bookId}/publish`, { method: 'PUT' });
      const body = await res.json();

      if (!res.ok) {
        setError(body?.error?.message ?? 'Failed to publish');
        return;
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handlePublish}
        disabled={disabled || loading}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? 'Publishing…' : 'Publish'}
      </button>
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </div>
  );
}
