'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { api } from '@/lib/api';

function EditBookPageContent() {
  const params  = useSearchParams();
  const router  = useRouter();
  const id      = params.get('id');
  const [book, setBook]     = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    // Find book by iterating pages — in production expose GET /admin/books/:id
    api.books.list(1, 100)
      .then(({ books }: any) => {
        const found = books.find((b: any) => b.id === id);
        setBook(found ?? null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding: 40, color: '#6B6B8A', fontSize: 14 }}>Loading book…</div>;
  if (!book)   return <div style={{ padding: 40, color: '#E74C3C', fontSize: 14 }}>Book not found.</div>;

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => router.push('/dashboard/books')}
          style={{ fontSize: 13, color: '#6B6B8A', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: 10 }}>
          ← Back to Books
        </button>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', fontFamily: 'Lora, serif' }}>Edit Book</h2>
        <p style={{ fontSize: 12, color: '#6B6B8A', marginTop: 3 }}>{book.title}</p>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E8E6E1', borderRadius: 14, padding: 24, boxShadow: '0 1px 3px rgba(26,26,46,0.06)' }}>
        {[['Title', book.title], ['Author', book.authorName], ['Type', book.contentType], ['Language', book.language], ['Chapters', book.totalChapters], ['Published', book.isPublished ? 'Yes' : 'No'], ['Premium', book.isPremium ? 'Yes' : 'No']].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F0EFF5', fontSize: 13 }}>
            <span style={{ color: '#6B6B8A' }}>{k}</span>
            <span style={{ fontWeight: 600, color: '#1A1A2E' }}>{String(v)}</span>
          </div>
        ))}
        <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
          {!book.isPublished && (
            <button onClick={() => api.books.publish(book.id).then(() => router.push('/dashboard/books'))}
              style={{ background: '#2ECC71', color: '#fff', fontWeight: 600, fontSize: 13, padding: '9px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              ✓ Publish Book
            </button>
          )}
          <button onClick={() => api.books.requestTranslation(book.id, 'es').then(() => alert('Translation queued!'))}
            style={{ background: '#1A1A2E', color: '#fff', fontWeight: 600, fontSize: 13, padding: '9px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            🌐 Request Translation
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EditBookPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#6B6B8A', fontSize: 14 }}>Loading…</div>}>
      <EditBookPageContent />
    </Suspense>
  );
}

