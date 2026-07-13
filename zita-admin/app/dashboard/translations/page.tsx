'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const LANGUAGES = [
  { code: 'es', name: 'Spanish' }, { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },  { code: 'ar', name: 'Arabic' },
  { code: 'zh', name: 'Chinese' }, { code: 'pt', name: 'Portuguese' },
  { code: 'sw', name: 'Swahili' }, { code: 'hi', name: 'Hindi' },
  { code: 'ja', name: 'Japanese' },{ code: 'ru', name: 'Russian' },
];

const statusStyle: Record<string, { bg: string; color: string }> = {
  COMPLETED:  { bg: '#E8F5E9', color: '#2ECC71' },
  PROCESSING: { bg: '#FFF8E1', color: '#F39C12' },
  PENDING:    { bg: '#F5F5F5', color: '#9E9E9E' },
  FAILED:     { bg: '#FFEBEE', color: '#E74C3C' },
};

// Mock translation records for display
const mockTranslations = [
  { id: '1', book: 'Things Fall Apart',     language: 'Spanish', status: 'COMPLETED',  progress: 100, chapters: '25/25', completedAt: 'May 10, 2025' },
  { id: '2', book: 'Atomic Habits',         language: 'French',  status: 'PROCESSING', progress: 65,  chapters: '13/20', completedAt: null },
  { id: '3', book: 'Deep Work',             language: 'Arabic',  status: 'PENDING',    progress: 0,   chapters: '0/18',  completedAt: null },
  { id: '4', book: 'The Midnight Library',  language: 'German',  status: 'FAILED',     progress: 32,  chapters: '6/18',  completedAt: null },
];

export default function TranslationsPage() {
  const [books, setBooks]         = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selBook, setSelBook]     = useState('');
  const [selLang, setSelLang]     = useState('es');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    api.books.list(1, 50).then(({ books }: any) => setBooks(books)).catch(() => {});
  }, []);

  async function requestTranslation() {
    if (!selBook) return;
    setRequesting(true);
    try {
      await api.books.requestTranslation(selBook, selLang);
      setShowModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', fontFamily: 'Lora, serif' }}>Translations</h2>
          <p style={{ fontSize: 12, color: '#6B6B8A', marginTop: 3 }}>Manage multi-language content pipeline.</p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ background: '#1A1A2E', color: '#fff', fontWeight: 600, fontSize: 12, padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          + Request Translation
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {mockTranslations.map(t => (
          <div key={t.id} style={{ background: '#fff', border: '1px solid #E8E6E1', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(26,26,46,0.06)' }}>
            <div style={{ fontSize: 28 }}>📖</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1A1A2E' }}>{t.book} → {t.language}</div>
              <div style={{ fontSize: 11, color: '#6B6B8A', marginTop: 2 }}>
                {t.status === 'COMPLETED' ? `Completed · ${t.chapters} chapters · ${t.completedAt}` :
                 t.status === 'PROCESSING' ? `Processing · Chapter ${t.chapters} in progress` :
                 t.status === 'FAILED'     ? `Failed · API error — ${t.chapters} chapters done` :
                 `Queued · Waiting for worker`}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <div style={{ flex: 1, height: 4, background: '#F0EFF5', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${t.progress}%`, borderRadius: 2, background: t.status === 'FAILED' ? '#E74C3C' : t.status === 'COMPLETED' ? '#2ECC71' : '#E8B84B', transition: 'width 0.5s ease' }} />
                </div>
                <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: '#6B6B8A', flexShrink: 0 }}>{t.progress}%</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, ...(statusStyle[t.status] ?? { bg: '#F5F5F5', color: '#9E9E9E' }) }}>
                {t.status}
              </span>
              {t.status === 'FAILED' && (
                <button style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 7, background: '#1A1A2E', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                  Retry
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Request modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 420, boxShadow: '0 20px 60px rgba(26,26,46,0.15)' }}>
            <h3 style={{ fontWeight: 700, fontSize: 16, color: '#1A1A2E', marginBottom: 4 }}>Request Translation</h3>
            <p style={{ fontSize: 12, color: '#6B6B8A', marginBottom: 20 }}>Queue a new translation job. The worker will process it automatically.</p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#6B6B8A', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Book</label>
              <select value={selBook} onChange={e => setSelBook(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #E8E6E1', borderRadius: 9, fontSize: 13, fontFamily: 'DM Sans, sans-serif', color: '#1A1A2E', background: '#F7F6F3', outline: 'none' }}>
                <option value="">Select a book…</option>
                {books.map((b: any) => <option key={b.id} value={b.id}>{b.title}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#6B6B8A', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Target Language</label>
              <select value={selLang} onChange={e => setSelLang(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #E8E6E1', borderRadius: 9, fontSize: 13, fontFamily: 'DM Sans, sans-serif', color: '#1A1A2E', background: '#F7F6F3', outline: 'none' }}>
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)}
                style={{ padding: '8px 16px', border: '1px solid #E8E6E1', borderRadius: 9, background: 'transparent', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', color: '#6B6B8A' }}>
                Cancel
              </button>
              <button onClick={requestTranslation} disabled={!selBook || requesting}
                style={{ padding: '8px 18px', border: 'none', borderRadius: 9, background: '#1A1A2E', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: (!selBook || requesting) ? 0.5 : 1 }}>
                {requesting ? 'Requesting…' : 'Queue Translation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
