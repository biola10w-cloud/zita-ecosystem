'use client';

import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Minus, Plus, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Book } from './library';

export function Reader({ book, signedIn }: { book: Book & { totalChapters: number }; signedIn: boolean }) {
  const [chapter, setChapter] = useState(0);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [fontSize, setFontSize] = useState(19);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!signedIn) return;
    setContent('');
    setError('');
    fetch(`/api/reader/${book.slug}/${chapter}`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? 'Unable to load this chapter.');
      setContent(body.data.content);
    }).catch((reason) => setError(reason.message));
  }, [book.slug, chapter, signedIn]);

  useEffect(() => {
    const recordProgress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const nextProgress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      setProgress(nextProgress);
    };
    window.addEventListener('scroll', recordProgress, { passive: true });
    return () => window.removeEventListener('scroll', recordProgress);
  }, []);

  useEffect(() => {
    if (!signedIn || !content) return;
    const timer = window.setTimeout(() => {
      fetch(`/api/reader/${book.slug}/${chapter}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterIndex: chapter, scrollPosition: progress }),
      }).catch(() => undefined);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [book.slug, chapter, content, progress, signedIn]);

  const chapterLabel = useMemo(() => `Chapter ${chapter + 1} of ${Math.max(book.totalChapters, 1)}`, [book.totalChapters, chapter]);
  const atLastChapter = chapter >= Math.max(book.totalChapters - 1, 0);

  return (
    <div className="reader-shell">
      <div className="reader-progress" style={{ transform: `scaleX(${progress})` }} />
      <header className="reader-bar">
        <Link href="/" className="icon-button" title="Back to library" aria-label="Back to library"><ArrowLeft size={19} /></Link>
        <div className="reader-title"><span>{book.authorName}</span><strong>{book.title}</strong></div>
        <div className="reader-controls"><Settings2 size={17} /><button className="icon-button compact" onClick={() => setFontSize((size) => Math.max(16, size - 1))} title="Decrease text size" aria-label="Decrease text size"><Minus size={16} /></button><button className="icon-button compact" onClick={() => setFontSize((size) => Math.min(24, size + 1))} title="Increase text size" aria-label="Increase text size"><Plus size={16} /></button></div>
      </header>
      <main className="reader-main">
        <p className="eyebrow">{chapterLabel}</p>
        <h1>{book.title}</h1>
        {!signedIn ? <div className="reader-gate"><h2>Continue with your account</h2><p>Sign in to read this title and keep your place.</p><Link className="button button-dark" href={`/login?next=/books/${book.slug}`}>Sign in to read</Link></div> : error ? <div className="reader-gate error"><h2>Unable to open this chapter</h2><p>{error}</p></div> : !content ? <p className="reader-loading">Opening chapter...</p> : <article className="chapter-content" style={{ fontSize: `${fontSize}px` }}>{content.split('\n').filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</article>}
        {signedIn && content && <nav className="chapter-nav" aria-label="Chapter navigation"><button className="button button-light" disabled={chapter === 0} onClick={() => { setChapter((value) => value - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><ChevronLeft size={17} /> Previous</button><button className="button button-dark" disabled={atLastChapter} onClick={() => { setChapter((value) => value + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Next <ChevronRight size={17} /></button></nav>}
      </main>
    </div>
  );
}
