'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Category {
  id: string;
  name: string;
}

export function CreateCategoryForm({ topLevelCategories }: { topLevelCategories: Category[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon: icon || undefined, parentId: parentId || undefined }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body?.error?.message ?? 'Failed to create category');
        return;
      }

      setName('');
      setIcon('');
      setParentId('');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase text-gray-400">Name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Investing"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase text-gray-400">Icon (emoji)</label>
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="💰"
          className="w-20 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase text-gray-400">Parent (optional)</label>
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">— Top-level category —</option>
          {topLevelCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Adding…' : '+ Add Category'}
      </button>
      {error && <span className="text-sm text-red-500">{error}</span>}
    </form>
  );
}
