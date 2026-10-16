'use client';

import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { readerRequest, ReaderRequestError } from '../lib/browser-api';
import type { Book } from './library';
import { ListenControls } from './listen-controls';

const languages: Record<string, string> = { en: 'English', fr: 'French', es: 'Spanish', de: 'German', pt: 'Portuguese', it: 'Italian', ar: 'Arabic', hi: 'Hindi', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', nl: 'Dutch', pl: 'Polish', tr: 'Turkish', sv: 'Swedish', sw: 'Swahili', yo: 'Yoruba', ig: 'Igbo', ha: 'Hausa' };

export function Reader({ book, signedIn }: { book: Book & { totalChapters: number }; signedIn: boolean }) {
  const [chapter, setChapter] = useState(0);
  const originalLanguage = book.language || 'en';
  const [language, setLanguage] = useState(originalLanguage);
  const [translationStatus, setTranslationStatus] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [fontSize, setFontSize] = useState(19);
  const [progress, setProgress] = useState(0);
  const [saveStatus, setSaveStatus] = useState('');
  const [retry, setRetry] = useState(0);
  const [navigating, setNavigating] = useState(false);
  const position = useRef({ chapterIndex: 0, scrollPosition: 0 });
  const resume = useRef(0);
  const dirty = useRef(false);
  const transitioning = useRef(true);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const endpoint = `/api/reader/${encodeURIComponent(book.slug)}`;
  const total = Math.max(book.totalChapters, 1);

  useEffect(() => {
    if (!signedIn || !ready) return;
    let active = true;
    let checking = false;
    const check = async () => {
      if (checking || document.visibilityState === 'hidden') return;
      checking = true;
      try { await readerRequest('/api/account'); }
      catch (reason) {
        if (active && reason instanceof ReaderRequestError && reason.status === 401) {
          setContent(''); setReady(false); setLoading(false); setError(reason.message);
        }
      } finally { checking = false; }
    };
    const timer = setInterval(() => { void check(); }, 15000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, [signedIn, ready]);

  const save = useCallback(async () => {
    if (!dirty.current) return;
    const snapshot = { ...position.current };
    setSaveStatus('Saving your place…');
    const task = queue.current.catch(() => undefined).then(() => readerRequest(`${endpoint}/${snapshot.chapterIndex}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot), keepalive: true,
    }));
    queue.current = task;
    try {
      await task;
      if (position.current.chapterIndex === snapshot.chapterIndex && position.current.scrollPosition === snapshot.scrollPosition) dirty.current = false;
      setSaveStatus('Your place is saved');
    } catch (reason) {
      setSaveStatus('Your place could not be saved. Please retry.');
      throw reason;
    }
  }, [endpoint]);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    setError('');
    readerRequest(`${endpoint}/progress`).then((saved) => {
      if (!active) return;
      const index = Math.min(total - 1, Math.max(0, saved?.chapterIndex ?? 0));
      resume.current = Math.min(1, Math.max(0, Number(saved?.scrollPosition) || 0));
      position.current = { chapterIndex: index, scrollPosition: resume.current };
      setChapter(index);
      setReady(true);
    }).catch((reason) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [endpoint, signedIn, total, retry]);

  useEffect(() => {
    if (!ready || !signedIn) return;
    let active = true;
    setLoading(true);
    setError('');
    setContent('');
    setTranslationStatus('');
    let timer: ReturnType<typeof setTimeout>;
    const open = async (attempt = 0): Promise<void> => {
      if (language !== originalLanguage && !book.availableLanguages?.includes(language)) {
        const result = await readerRequest(`${endpoint}/translations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language }) });
        if (!active) return;
        if (result.status === 'FAILED') throw new Error('This translation could not be prepared. Please choose the original language or try another language.');
        if (result.status !== 'COMPLETED') {
          if (attempt >= 60) throw new Error('Translation is still being prepared. Please return later or read in the original language.');
          setTranslationStatus(`Preparing the ${languages[language] || language} translation… You can return to the original language at any time.`);
          timer = setTimeout(() => { void open(attempt + 1).catch(failed); }, 10000);
          return;
        }
      }
      if (!active) return;
      const data = await readerRequest(`${endpoint}/${chapter}?language=${encodeURIComponent(language)}`);
      if (!active) return;
      setContent(data.content);
      setTranslationStatus('');
      setLoading(false);
    };
    const failed = (reason: Error) => { if (active) { setError(reason.message); setTranslationStatus(''); setLoading(false); } };
    void open().catch(failed);
    return () => { active = false; clearTimeout(timer); };
  }, [chapter, endpoint, ready, signedIn, retry, language, originalLanguage, book.availableLanguages]);

  useEffect(() => {
    if (loading || error || !ready) return;
    const target = resume.current;
    resume.current = 0;
    window.scrollTo({ top: target * Math.max(0, document.documentElement.scrollHeight - window.innerHeight), behavior: 'instant' as ScrollBehavior });
    setProgress(target);
    let timer: ReturnType<typeof setTimeout>;
    let listening = false;
    const frame = requestAnimationFrame(() => { listening = true; transitioning.current = false; });
    const record = () => {
      if (!listening || transitioning.current) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const value = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      position.current = { chapterIndex: chapter, scrollPosition: value };
      dirty.current = true;
      setProgress(value);
      clearTimeout(timer);
      timer = setTimeout(() => { void save().catch(() => undefined); }, 900);
    };
    const leaving = () => { void save().catch(() => undefined); };
    const hidden = () => { if (document.visibilityState === 'hidden') leaving(); };
    window.addEventListener('scroll', record, { passive: true });
    window.addEventListener('pagehide', leaving);
    document.addEventListener('visibilitychange', hidden);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); window.removeEventListener('scroll', record); window.removeEventListener('pagehide', leaving); document.removeEventListener('visibilitychange', hidden); };
  }, [chapter, loading, error, ready, save]);

  async function navigate(next: number | string | null) {
    transitioning.current = true;
    setNavigating(true);
    try {
      await save();
      if (next === null || typeof next === 'string') { window.location.assign(next || '/'); return; }
      const previous = { ...position.current };
      position.current = { chapterIndex: next, scrollPosition: 0 };
      dirty.current = true;
      try { await save(); } catch (reason) { position.current = previous; dirty.current = true; throw reason; }
      resume.current = 0;
      setLoading(true);
      setChapter(next);
    } catch { transitioning.current = false; }
    finally { setNavigating(false); }
  }

  return <div className="reader-shell">
    <div className="reader-progress" style={{ transform: `scaleX(${progress})` }} />
    <header className="reader-bar">
      <button className="icon-button" onClick={() => void navigate(null)} disabled={navigating} aria-label="Back to library"><ArrowLeft size={19} /></button>
      <div className="reader-title"><span>{book.authorName}</span><strong>{book.title}</strong></div>
      <div className="reader-controls"><button className="icon-button compact" onClick={() => setFontSize((size) => Math.max(16, size - 1))} aria-label="Decrease text size"><Minus size={16} /></button><button className="icon-button compact" onClick={() => setFontSize((size) => Math.min(28, size + 1))} aria-label="Increase text size"><Plus size={16} /></button></div>
    </header>
    <main className="reader-main">
      <p className="eyebrow">Chapter {chapter + 1} of {total}</p><h1>{book.title}</h1>
      <button className="read-pill" disabled={navigating} onClick={() => void navigate('/community')}>Join the community</button>
      {signedIn && <div className="reader-language"><label htmlFor="reading-language">Reading language</label><select id="reading-language" value={language} onChange={event => { transitioning.current = true; resume.current = position.current.scrollPosition; setLoading(true); setLanguage(event.target.value); }}>
        <option value={originalLanguage}>{languages[originalLanguage] || originalLanguage} (original)</option>
        {Object.entries(languages).filter(([code]) => code !== originalLanguage).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
      </select>{language !== originalLanguage && <small>Machine translation</small>}</div>}
      {signedIn && !loading && !error && <ListenControls key={`${chapter}-${language}`} text={content} language={language} />}
      {!signedIn ? <div className="reader-gate"><h2>Continue with your account</h2><p>Sign in to read this title and keep your place.</p><Link className="button button-dark" href={`/login?next=${encodeURIComponent(`/books/${book.slug}/read`)}`}>Sign in to read</Link></div>
        : error ? <div className="reader-gate error" role="alert"><h2>Unable to open your book</h2><p>{error}</p><button className="button button-light" onClick={() => { setReady(false); setLoading(true); setRetry((value) => value + 1); }}>Try again</button> <Link className="button button-dark" href={`/login?next=${encodeURIComponent(`/books/${book.slug}/read`)}`}>Sign in again</Link></div>
        : loading ? <p className="reader-loading" role="status">{translationStatus || 'Opening your book…'}</p>
        : <article className="chapter-content" lang={language} dir={language === 'ar' ? 'rtl' : 'auto'} style={{ fontSize: `${fontSize}px` }}>{content.split('\n').filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</article>}
      {saveStatus && <p role="status" className="save-status">{saveStatus} {saveStatus.includes('could not') && <button className="button button-light" onClick={() => void save().catch(() => undefined)}>Retry save</button>}</p>}
      {signedIn && !loading && !error && <nav className="chapter-nav" aria-label="Chapter navigation"><button className="button button-light" disabled={chapter === 0 || navigating} onClick={() => void navigate(chapter - 1)}><ChevronLeft size={17} /> Previous</button><button className="button button-dark" disabled={navigating} onClick={() => void navigate(chapter >= total - 1 ? null : chapter + 1)}>{chapter >= total - 1 ? 'Back to library' : 'Next chapter'}<ChevronRight size={17} /></button></nav>}
    </main>
  </div>;
}
