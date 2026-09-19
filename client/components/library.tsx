'use client';

import Link from 'next/link';
import { BookOpen, Search, ChevronDown, UserRound, X, Play } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Brand, AppNav } from './app-nav';
import { ReadingShelf } from './reading-shelf';
import { readerRequest } from '../lib/browser-api';
import type { ReadingStats } from '../lib/reading-stats';

export interface Book {
  language?: string; availableLanguages?: string[];
  id: string; slug: string; title: string; authorName: string; description: string;
  coverUrl: string | null; contentType: string; estimatedMinutes: number; isPremium: boolean;
  category: { name: string; slug: string; icon?: string | null } | null; tags: string[];
}
interface Category { id: string; name: string; slug: string; icon?: string | null; bookCount: number; children?: Category[]; }

export function Library({ books: initialBooks, categories, signedIn, error, explore = false, featured = [] }: { books: Book[]; categories: Category[]; signedIn: boolean; error: string; explore?: boolean; featured?: Book[] }) {
  const [books, setBooks] = useState(initialBooks);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialBooks.length === 24);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [showSearch, setShowSearch] = useState(explore);
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [statsError, setStatsError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const visibleBooks = useMemo(() => books.filter((book) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || [book.title, book.authorName, book.description, ...(book.tags || [])].join(' ').toLowerCase().includes(needle);
    const selected = categories.find((item) => item.slug === category);
    return matchesQuery && (category === 'all' || book.category?.slug === category || selected?.children?.some((item) => item.slug === book.category?.slug));
  }), [books, categories, category, query]);

  useEffect(() => {
    if (!signedIn || explore) return;
    let active = true;
    setStatsError('');
    readerRequest('/api/reading-stats').then((data) => { if (active) setStats(data); }).catch(() => {
      if (active) setStatsError('Your reading activity couldn’t be loaded.');
    });
    return () => { active = false; };
  }, [signedIn, explore, attempt]);

  async function loadMore() {
    setLoading(true); setLoadError('');
    try {
      const response = await fetch(`/api/catalog?page=${page + 1}`);
      const body = await response.json();
      if (!response.ok) throw new Error();
      setBooks((current) => [...current, ...body.data.filter((book: Book) => !current.some((item) => item.id === book.id))]);
      setHasMore(body.data.length === 24); setPage((current) => current + 1);
    } catch { setLoadError('Unable to load more books. Please retry.'); }
    finally { setLoading(false); }
  }

  const featuredBook = featured[0];
  return <div className="app-shell catalog-shell">
    <header className="topbar"><Brand /><div className="topbar-actions"><button className="icon-button" onClick={() => setShowSearch((value) => !value)} aria-label="Search books" aria-expanded={showSearch}><Search size={20} /></button>{signedIn ? <Link href="/dashboard" className="avatar" aria-label="Dashboard"><UserRound size={18} /></Link> : <Link className="button button-dark compact-button" href="/login">Sign in</Link>}</div></header>
    <main className="catalog-main">
      {explore && <h1 className="page-heading">Explore</h1>}
      {showSearch && <label className="search-field"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search loaded books, authors, or topics" aria-label="Search loaded books" />{query && <button className="icon-button" onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>}</label>}
      <div className="category-bar"><div className="category-select"><BookOpen size={17} /><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Browse by Category"><option value="all">Browse by Category</option>{categories.map((item) => <optgroup key={item.id} label={item.name}><option value={item.slug}>{item.name}</option>{item.children?.map((child) => <option value={child.slug} key={child.id}>{child.name}</option>)}</optgroup>)}</select><ChevronDown size={15} /></div>
        <div className="filter-row" aria-label="Book categories"><button className={category === 'all' ? 'filter active' : 'filter'} onClick={() => setCategory('all')}>All</button>{categories.map((item) => <button key={item.id} className={category === item.slug ? 'filter active' : 'filter'} onClick={() => setCategory(item.slug)}>{item.icon} {item.name}</button>)}</div>
      </div>
      {!explore && <>
        <section className="home-continue"><div className="section-heading"><h2>Continue Reading</h2><Link href="/library">See all</Link></div>
          {!signedIn ? <div className="inline-empty"><BookOpen size={21} /><p>Sign in to keep your books and reading progress together.</p><Link href="/login" className="read-pill">Sign in</Link></div>
            : statsError ? <div className="inline-empty" role="alert"><p>{statsError}</p><button className="read-pill" onClick={() => setAttempt((value) => value + 1)}>Retry</button></div>
            : !stats ? <p className="muted" role="status">Loading your reading activity…</p>
            : stats.inProgressBooks.length ? <ReadingShelf books={stats.inProgressBooks} horizontal /> : <div className="inline-empty"><BookOpen size={24} /><p>Open your first book. Your saved place will appear here.</p></div>}
        </section>
        {featuredBook ? <Link href={`/books/${encodeURIComponent(featuredBook.slug)}`} className="featured-card"><div className="featured-cover">{featuredBook.coverUrl ? <img src={`/api/covers/${encodeURIComponent(featuredBook.slug)}`} alt="" /> : <BookOpen size={38} />}</div><div className="featured-meta"><p className="featured-badge">✦ Featured</p><h2>{featuredBook.title}</h2><p className="featured-author">{featuredBook.authorName}</p><span className="featured-btn"><Play size={12} fill="currentColor" /> Read now</span></div></Link>
          : null}
      </>}
      <section className="library-section" id="library"><div className="section-heading"><h2>{explore || query || category !== 'all' ? 'Browse Books' : 'Latest Books'}</h2><span>{visibleBooks.length} available</span></div>
        {error ? <div className="empty-state" role="alert"><p>{error}</p><button className="button button-dark" onClick={() => window.location.reload()}>Try again</button></div>
          : visibleBooks.length ? <div className="book-grid">{visibleBooks.map((book) => <BookCard key={book.id} book={book} />)}</div>
          : <div className="empty-state"><BookOpen size={28} /><h3>{books.length ? 'No matching books' : 'Your next chapter is coming.'}</h3><p>{books.length ? 'Try another title, author, or category.' : 'Your library is ready. Books will appear here as they are published.'}</p>{(query || category !== 'all') && <button className="button button-light" onClick={() => { setQuery(''); setCategory('all'); }}>Clear filters</button>}</div>}
        {loadError && <p role="alert" className="form-error">{loadError}</p>}{hasMore && <div className="load-more"><button className="button button-light" onClick={loadMore} disabled={loading}>{loading ? 'Loading…' : 'Load more books'}</button></div>}
      </section>
    </main><AppNav active={explore ? 'explore' : 'home'} />
  </div>;
}
function BookCard({ book }: { book: Book }) {
  return <Link href={`/books/${encodeURIComponent(book.slug)}`} className="book-card"><div className="cover-frame">{book.coverUrl ? <img src={`/api/covers/${encodeURIComponent(book.slug)}`} alt={`Cover of ${book.title}`} /> : <div className="cover-placeholder"><BookOpen size={38} /></div>}</div><div className="book-copy"><h3>{book.title}</h3><p className="author">{book.authorName}</p><div className="book-card-meta"><span className={book.isPremium ? 'premium-tag' : 'free-tag'}>{book.isPremium ? 'Premium' : 'Free'}</span><span>{book.estimatedMinutes} min</span></div></div></Link>;
}
