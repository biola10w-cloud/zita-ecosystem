'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { api } from '@/lib/api';

type Step = 'metadata' | 'files' | 'review' | 'processing';

const LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' }, { code: 'de', name: 'German' },
  { code: 'ar', name: 'Arabic' },  { code: 'pt', name: 'Portuguese' },
  { code: 'sw', name: 'Swahili' }, { code: 'zh', name: 'Chinese' },
  { code: 'hi', name: 'Hindi' },   { code: 'yo', name: 'Yoruba' },
];

const card  = { background: '#fff', border: '1px solid #E8E6E1', borderRadius: 14, padding: 24, boxShadow: '0 1px 3px rgba(26,26,46,0.06)' };
const input = { width: '100%', padding: '8px 12px', border: '1px solid #E8E6E1', borderRadius: 9, fontSize: 13, fontFamily: 'DM Sans, sans-serif', color: '#1A1A2E', background: '#F7F6F3', outline: 'none' };
const label = { display: 'block', fontSize: 10, fontWeight: 600, color: '#6B6B8A', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 5 };
const btnPrimary = { background: '#1A1A2E', color: '#fff', fontWeight: 600, fontSize: 13, padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' };
const btnGhost  = { background: 'transparent', color: '#6B6B8A', fontSize: 13, padding: '8px 14px', borderRadius: 9, border: '1px solid #E8E6E1', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' };

export default function NewBookPage() {
  const router  = useRouter();
  const [step, setStep]         = useState<Step>('metadata');
  const [error, setError]       = useState('');
  const [jobId, setJobId]       = useState('');
  const [bookId, setBookId]     = useState('');
  const [contentFile, setContentFile] = useState<File | null>(null);
  const [coverFile, setCoverFile]     = useState<File | null>(null);
  const [meta, setMeta] = useState({
    title: '', authorName: '', description: '', contentType: 'BOOK',
    language: 'en', estimatedMinutes: 60, isPremium: true, price: '', tags: '',
  });

  const onContent = useCallback((files: File[]) => setContentFile(files[0] ?? null), []);
  const onCover   = useCallback((files: File[]) => setCoverFile(files[0] ?? null), []);

  const { getRootProps: getCP, getInputProps: getCI, isDragActive: isCDrag } =
    useDropzone({ onDrop: onContent, accept: { 'text/plain': ['.txt'], 'text/markdown': ['.md'] }, maxFiles: 1 });
  const { getRootProps: getIP, getInputProps: getII, isDragActive: isIDrag } =
    useDropzone({ onDrop: onCover, accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }, maxFiles: 1 });

  const steps = ['metadata', 'files', 'review', 'processing'];
  const stepIdx = steps.indexOf(step);

  async function handleSubmit() {
    if (!contentFile || !coverFile) { setError('Both files are required'); return; }
    setStep('processing'); setError('');
    const fd = new FormData();
    fd.append('metadata', JSON.stringify({ ...meta, estimatedMinutes: Number(meta.estimatedMinutes), price: meta.price ? Number(meta.price) : undefined, tags: meta.tags.split(',').map(t => t.trim()).filter(Boolean) }));
    fd.append('content', contentFile);
    fd.append('cover', coverFile);
    try {
      const res = await api.books.create(fd);
      if (!res.success) { setError(res.error?.message ?? 'Upload failed'); setStep('review'); return; }
      setJobId(String(res.data.encryptionJobId));
      setBookId(res.data.book.id);
    } catch (e: any) { setError(e.message ?? 'Upload failed'); setStep('review'); }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', fontFamily: 'Lora, serif' }}>Upload New Book</h2>
        <p style={{ fontSize: 12, color: '#6B6B8A', marginTop: 3 }}>Content is AES-256-GCM encrypted before storage.</p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        {['Metadata', 'Files', 'Review', 'Processing'].map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: i < stepIdx ? '#2ECC71' : i === stepIdx ? '#E8B84B' : '#E8E6E1', color: i <= stepIdx ? (i < stepIdx ? 'white' : '#1A1A2E') : '#6B6B8A' }}>
              {i < stepIdx ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 12, fontWeight: i === stepIdx ? 700 : 400, color: i === stepIdx ? '#1A1A2E' : '#6B6B8A', display: 'none' }} className="sm:inline">{s}</span>
            {i < 3 && <div style={{ width: 24, height: 1, background: '#E8E6E1' }} />}
          </div>
        ))}
      </div>

      <div style={card}>
        {step === 'metadata' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ fontWeight: 600, color: '#1A1A2E', marginBottom: 4 }}>Book Details</h3>
            {[['Title', 'title', 'e.g. Things Fall Apart'], ['Author Name', 'authorName', 'e.g. Chinua Achebe']].map(([lbl, key, ph]) => (
              <div key={key}>
                <label style={label}>{lbl}</label>
                <input style={input} placeholder={ph} value={(meta as any)[key]} onChange={e => setMeta({ ...meta, [key]: e.target.value })} />
              </div>
            ))}
            <div>
              <label style={label}>Description</label>
              <textarea style={{ ...input, height: 80, resize: 'none' }} placeholder="A brief synopsis..." value={meta.description} onChange={e => setMeta({ ...meta, description: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={label}>Content Type</label>
                <select style={input} value={meta.contentType} onChange={e => setMeta({ ...meta, contentType: e.target.value })}>
                  {['BOOK', 'STORY', 'SUMMARY'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Language</label>
                <select style={input} value={meta.language} onChange={e => setMeta({ ...meta, language: e.target.value })}>
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Est. Minutes</label>
                <input type="number" style={input} value={meta.estimatedMinutes} onChange={e => setMeta({ ...meta, estimatedMinutes: Number(e.target.value) })} />
              </div>
              <div>
                <label style={label}>Price USD (blank = sub only)</label>
                <input type="number" step="0.01" style={input} placeholder="Leave blank" value={meta.price} onChange={e => setMeta({ ...meta, price: e.target.value })} />
              </div>
            </div>
            <div>
              <label style={label}>Tags (comma-separated)</label>
              <input style={input} placeholder="fiction, africa, classic" value={meta.tags} onChange={e => setMeta({ ...meta, tags: e.target.value })} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setMeta({ ...meta, isPremium: !meta.isPremium })} style={{ width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: meta.isPremium ? '#E8B84B' : '#E8E6E1', position: 'relative', transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: 2, left: meta.isPremium ? 20 : 2, width: 20, height: 20, background: 'white', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
              </button>
              <span style={{ fontSize: 13, color: '#1A1A2E' }}>Premium content</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
              <button style={btnPrimary} disabled={!meta.title || !meta.authorName} onClick={() => setStep('files')}>Continue →</button>
            </div>
          </div>
        )}

        {step === 'files' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontWeight: 600, color: '#1A1A2E' }}>Upload Files</h3>
            {[
              { label: 'Book Content (.txt or .md)', props: { getRootProps: getCP, getInputProps: getCI, isDragActive: isCDrag }, file: contentFile, icon: '📄', hint: 'Chapters separated by === CHAPTER N ===' },
              { label: 'Cover Image (JPG/PNG/WebP)', props: { getRootProps: getIP, getInputProps: getII, isDragActive: isIDrag }, file: coverFile, icon: '🖼️', hint: 'Recommended: 400×600px' },
            ].map(({ label: lbl, props, file, icon, hint }) => (
              <div key={lbl}>
                <label style={label}>{lbl}</label>
                <div {...props.getRootProps()} style={{ border: `2px dashed ${file ? '#2ECC71' : props.isDragActive ? '#E8B84B' : '#E8E6E1'}`, borderRadius: 10, padding: 28, textAlign: 'center', cursor: 'pointer', background: file ? '#E8F5E9' : props.isDragActive ? '#FDF3DC' : 'transparent', transition: 'all 0.15s' }}>
                  <input {...props.getInputProps()} />
                  {file ? (
                    <div style={{ color: '#2ECC71' }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>✓</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{file.name}</div>
                      <div style={{ fontSize: 11, color: '#6B6B8A', marginTop: 3 }}>{(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                  ) : (
                    <div style={{ color: '#6B6B8A' }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>Drop file here or click</div>
                      <div style={{ fontSize: 11, marginTop: 4 }}>{hint}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
              <button style={btnGhost} onClick={() => setStep('metadata')}>← Back</button>
              <button style={btnPrimary} disabled={!contentFile || !coverFile} onClick={() => setStep('review')}>Continue →</button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ fontWeight: 600, color: '#1A1A2E' }}>Review & Submit</h3>
            <div style={{ background: '#F7F6F3', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['Title', meta.title], ['Author', meta.authorName], ['Type', meta.contentType], ['Language', LANGUAGES.find(l => l.code === meta.language)?.name], ['Duration', `${meta.estimatedMinutes} mins`], ['Premium', meta.isPremium ? 'Yes' : 'No'], ['Content', contentFile?.name], ['Cover', coverFile?.name]].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6B6B8A' }}>{k}</span>
                  <span style={{ fontWeight: 600, color: '#1A1A2E' }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 10, padding: 12, fontSize: 12, color: '#F57C00' }}>
              ⚡ Book will be AES-256-GCM encrypted in the background. Publish when encryption completes.
            </div>
            {error && <div style={{ background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: 10, padding: 12, fontSize: 12, color: '#E74C3C' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
              <button style={btnGhost} onClick={() => setStep('files')}>← Back</button>
              <button style={btnPrimary} onClick={handleSubmit}>Upload & Encrypt</button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            {!jobId ? (
              <>
                <div style={{ width: 44, height: 44, border: '4px solid rgba(232,184,75,0.2)', borderTopColor: '#E8B84B', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                <div style={{ fontWeight: 600, color: '#1A1A2E' }}>Uploading…</div>
                <div style={{ fontSize: 13, color: '#6B6B8A', marginTop: 6 }}>Transferring files to secure storage</div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </>
            ) : (
              <>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: '#1A1A2E', marginBottom: 8 }}>Encryption In Progress</div>
                <div style={{ fontSize: 13, color: '#6B6B8A', maxWidth: 380, margin: '0 auto 24px' }}>
                  Your book is being encrypted with AES-256-GCM in the background.<br />
                  Job ID: <code style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, background: '#F7F6F3', padding: '1px 5px', borderRadius: 4 }}>{jobId}</code>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button style={btnPrimary} onClick={() => api.books.publish(bookId).then(() => router.push('/dashboard/books'))}>
                    Publish When Ready
                  </button>
                  <button style={btnGhost} onClick={() => router.push('/dashboard/books')}>Back to Books</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
