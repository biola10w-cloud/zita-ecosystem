'use client';

import Link from 'next/link';
import { BookOpen, LogOut, Flame } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readerRequest, ReaderRequestError } from '../lib/browser-api';
import type { ReadingStats } from '../lib/reading-stats';
import { ReadingShelf } from './reading-shelf';
import { AppNav } from './app-nav';

interface ReaderAccount { displayName: string; email: string; }

export function Dashboard({ libraryOnly = false }: { libraryOnly?: boolean }) {
  const [account, setAccount] = useState<ReaderAccount | null>(null);
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [error, setError] = useState('');
  const [statsError, setStatsError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    setError(''); setStatsError('');
    async function load() {
      try {
        const user = await readerRequest('/api/account');
        if (!active) return;
        setAccount(user);
      } catch (reason) {
        if (!active) return;
        if (reason instanceof ReaderRequestError && reason.status === 401) window.location.replace(`/login?next=${libraryOnly ? '/library' : '/dashboard'}`);
        else setError('We couldn’t load your account. Please try again.');
        return;
      }
      try {
        const activity = await readerRequest('/api/reading-stats');
        if (active) setStats(activity);
      } catch { if (active) setStatsError('Your reading activity is temporarily unavailable. Please try again.'); }
    }
    void load();
    return () => { active = false; };
  }, [attempt, libraryOnly]);

  async function signOut() {
    setSigningOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error();
      window.location.assign('/');
    } catch { setError('Unable to sign out. Please try again.'); setSigningOut(false); }
  }

  return <div className="app-shell dashboard-shell">
    <header className="topbar"><h1 className="app-page-title">{libraryOnly ? 'My Library' : 'My Reading'}</h1><div className="topbar-actions"><Link href="/explore" className="section-link">Explore</Link><button className="icon-button" onClick={signOut} disabled={signingOut} aria-label="Sign out" title="Sign out"><LogOut size={19} /></button></div></header>
    <main className="dashboard-main">
      {(error || statsError) && <div className="dashboard-error" role="alert"><p>{error || statsError}</p><button className="button button-light" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div>}
      {!libraryOnly && <section className="streak-card" aria-label="Reading statistics"><div className="streak-row"><div className="streak-col"><p className="streak-label"><Flame size={15} /> Reading Streak</p><strong className="streak-number">{stats?.streakDays ?? '—'}</strong><p className="streak-unit">days</p></div><div className="stat-chips"><div className="stat-chip"><strong>{stats?.completedBooks ?? '—'}</strong><span>Books read</span></div><div className="stat-chip"><strong>{stats?.totalSessions ?? '—'}</strong><span>Reading sessions</span></div></div></div><p className="streak-note">A little reading, every day.</p></section>}
      <section className="reading-section"><div className="section-heading"><h2>Currently Reading</h2><Link href="/explore">Find a book</Link></div>
        {!stats ? <div className="inline-empty" role="status"><BookOpen size={23} /><p>{statsError || error ? 'Reading progress is unavailable right now.' : 'Loading your reading progress…'}</p></div>
          : stats.inProgressBooks.length ? <ReadingShelf books={stats.inProgressBooks} />
          : <div className="empty-state"><BookOpen size={28} /><h3>Your reading journey starts here.</h3><p>Open a book and your saved progress will appear here.</p><Link className="button button-dark" href="/explore">Explore books</Link></div>}
      </section>
      <section className="reading-section"><div className="section-heading"><h2>My Highlights</h2>{stats && <span>{stats.highlightCount} saved</span>}</div>
        {!stats ? <p className="muted">{statsError || error ? 'Highlights are unavailable right now.' : 'Loading your highlights…'}</p>
          : stats.highlights.length ? <div className="highlight-list">{stats.highlights.map((item) => <Link key={item.id} href={`/books/${encodeURIComponent(item.book.slug)}`} className="highlight-card"><blockquote>{item.text}</blockquote><p>{item.book.title} · Chapter {item.chapterIndex + 1}</p></Link>)}</div>
          : <div className="highlight-card"><p className="muted">Your saved highlights will appear here.</p></div>}
      </section>
      {!libraryOnly && <section className="account-panel" id="account"><h2>{account ? `Welcome, ${account.displayName || 'reader'}.` : 'Your account'}</h2>{account ? <><dl className="account-details"><div><dt>Name</dt><dd>{account.displayName}</dd></div><div><dt>Email</dt><dd>{account.email}</dd></div></dl><Link className="section-link" href="/forgot-password">Reset your password</Link></> : <p className="muted">{error ? 'Account details are unavailable.' : 'Loading your account…'}</p>}</section>}
      {!libraryOnly && <p><Link href="/delete-account">Delete account</Link></p>}
    </main><AppNav active={libraryOnly ? 'library' : 'profile'} />
  </div>;
}
