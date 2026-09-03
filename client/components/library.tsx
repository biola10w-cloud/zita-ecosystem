'use client';

import Link from 'next/link';
import { BookOpen, Clock3, LogOut, Search, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';

export interface Book {
  id: string;
  slug: string;
  title: string;
  authorName: string;
  description: string;
  coverUrl: string | null;
  contentType: string;
  estimatedMinutes: number;
  isPremium: boolean;
  category: { name: string; slug: string; icon?: string | null } | null;
  tags: string[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  bookCount: number;
}

export function Library({ books, categories, signedIn }: { books: Book[]; categories: Category[]; signedIn: boolean }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const visibleBooks = useMemo(() => books.filter((book) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || [book.title, book.authorName, book.description, ...book.tags]
      .join(' ').toLowerCase().includes(needle);
    return matchesQuery && (category === 'all' || book.category?.slug === category);
  }), [books, category, query]);

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.assign('/');
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Zita library home"><BookOpen size={21} /> Zita</Link>
        <div className="topbar-actions">
          <Link className="text-link" href="#library">Library</Link>
          {signedIn ? (
            <button className="icon-button" onClick={signOut} title="Sign out" aria-label="Sign out"><LogOut size={18} /></button>
          ) : (
            <Link className="button button-dark" href="/login">Sign in</Link>
          )}
        </div>
      </header>

      <main>
        <section className="library-intro">
          <p className="eyebrow"><Sparkles size={14} /> Read with intent</p>
          <h1>A calmer place to grow.</h1>
          <p>Explore practical books and focused summaries, then pick up exactly where you left off.</p>
          <label className="search-field">
            <Search size={19} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search books, authors, or topics" aria-label="Search books" />
            {query && <button type="button" className="icon-button compact" onClick={() => setQuery('')} title="Clear search" aria-label="Clear search"><X size={16} /></button>}
          </label>
        </section>

        <section className="library-section" id="library">
          <div className="section-heading">
            <div><p className="eyebrow">Your library</p><h2>Find your next read</h2></div>
            <span>{visibleBooks.length} available</span>
          </div>
          <div className="filter-row" aria-label="Book categories">
            <button className={category === 'all' ? 'filter active' : 'filter'} onClick={() => setCategory('all')}>All</button>
            {categories.filter((item) => item.bookCount > 0).map((item) => (
              <button key={item.id} className={category === item.slug ? 'filter active' : 'filter'} onClick={() => setCategory(item.slug)}>{item.icon} {item.name}</button>
            ))}
          </div>
          {visibleBooks.length ? <div className="book-grid">{visibleBooks.map((book) => <BookCard key={book.id} book={book} />)}</div> : <div className="empty-state"><BookOpen size={28} /><p>No published books match that search yet.</p></div>}
        </section>
      </main>
    </div>
  );
}

function BookCard({ book }: { book: Book }) {
  return (
    <Link href={`/books/${book.slug}`} className="book-card">
      <div className="cover-frame">
        {book.coverUrl ? <img src={book.coverUrl} alt={`Cover of ${book.title}`} /> : <div className="cover-placeholder"><BookOpen size={30} /></div>}
        {book.isPremium && <span className="premium-tag">Premium</span>}
      </div>
      <div className="book-copy">
        <p className="book-meta">{book.category?.name ?? book.contentType}</p>
        <h3>{book.title}</h3>
        <p className="author">{book.authorName}</p>
        <p className="description">{book.description}</p>
        <span className="reading-time"><Clock3 size={14} /> {book.estimatedMinutes} min read</span>
      </div>
    </Link>
  );
}
