'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CategoryOption {
  id: string;
  name: string;
  children: { id: string; name: string }[];
}

export function UploadForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    const contentFile = data.get('content') as File;
    const coverFile = data.get('cover') as File;

    if (!contentFile?.size || !coverFile?.size) {
      setError('Both the content file and cover image are required.');
      setLoading(false);
      return;
    }

    const tags = (data.get('tags') as string)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const metadata = {
      title: data.get('title'),
      authorName: data.get('authorName'),
      description: data.get('description'),
      contentType: data.get('contentType'),
      language: data.get('language'),
      estimatedMinutes: Number(data.get('estimatedMinutes')),
      isPremium: data.get('isPremium') === 'on',
      price: data.get('price') ? Number(data.get('price')) : undefined,
      categoryId: data.get('categoryId') || undefined,
      tags,
    };

    const formData = new FormData();
    formData.append('metadata', JSON.stringify(metadata));
    formData.append('content', contentFile);
    formData.append('cover', coverFile);

    try {
      const res = await fetch('/api/books', { method: 'POST', body: formData });
      const body = await res.json();

      if (!res.ok) {
        setError(body?.error?.message ?? 'Upload failed');
        return;
      }

      setSuccess('Uploaded! Encryption is running in the background — check the Books list in a moment.');
      form.reset();
      router.refresh();
    } catch {
      setError('Could not reach the server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      <Field label="Title">
        <input name="title" required maxLength={200} className={inputClass} />
      </Field>

      <Field label="Author name">
        <input name="authorName" required maxLength={100} className={inputClass} />
      </Field>

      <Field label="Description">
        <textarea name="description" required maxLength={5000} rows={4} className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Content type">
          <select name="contentType" className={inputClass} defaultValue="SUMMARY">
            <option value="BOOK">Book (full)</option>
            <option value="STORY">Story</option>
            <option value="SUMMARY">Summary</option>
          </select>
        </Field>

        <Field label="Language (2-letter code)">
          <input name="language" required defaultValue="en" maxLength={2} className={inputClass} />
        </Field>
      </div>

      <Field label="Category">
        <select name="categoryId" className={inputClass} defaultValue="">
          <option value="">— No category —</option>
          {categories.map((cat) => (
            <optgroup key={cat.id} label={cat.name}>
              {cat.children.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Estimated reading time (minutes)">
          <input name="estimatedMinutes" type="number" min={1} required defaultValue={30} className={inputClass} />
        </Field>

        <Field label="Price (USD, optional)">
          <input name="price" type="number" min={0} step="0.01" className={inputClass} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input name="isPremium" type="checkbox" defaultChecked />
        Premium (requires subscription or purchase)
      </label>

      <Field label="Tags (comma-separated)">
        <input name="tags" placeholder="finance, investing, mindset" className={inputClass} />
      </Field>

      <Field label="Book content (.txt or .md)">
        <input name="content" type="file" accept=".txt,.md" required className={inputClass} />
      </Field>

      <Field label="Cover image (JPG, PNG, WebP)">
        <input name="cover" type="file" accept="image/*" required className={inputClass} />
      </Field>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-lg bg-primary py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Uploading…' : 'Upload & Encrypt'}
      </button>
    </form>
  );
}

const inputClass =
  'rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-accent';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase text-gray-400">{label}</span>
      {children}
    </label>
  );
}
