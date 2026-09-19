import { notFound } from 'next/navigation';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { AppNav, Brand } from '@/components/app-nav';
import type { Book } from '@/components/library';
import { apiFetch, ApiError } from '@/lib/api';
import { hasReaderSession } from '@/lib/session';

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const book = await apiFetch<Book & { totalChapters: number }>(`/books/${encodeURIComponent(slug)}`);
    const signedIn = await hasReaderSession();
    const readPath = `/books/${encodeURIComponent(book.slug)}/read`;
    return <div className="app-shell"><header className="topbar"><Brand /><Link href="/explore">Browse books</Link></header>
      <main className="book-details">
        <div className="book-details-cover">{book.coverUrl ? <img src={`/api/covers/${encodeURIComponent(book.slug)}`} alt={`Cover of ${book.title.trim()}`} /> : <BookOpen size={64} />}</div>
        <div className="book-details-copy"><p className="eyebrow">{book.contentType === 'SUMMARY' ? 'Book summary' : 'Book'}</p><h1>{book.title.trim()}</h1><p className="book-details-author">By {book.authorName}</p>
          <p className="muted">{book.totalChapters} chapters · {book.estimatedMinutes} min{book.category ? ` · ${book.category.name}` : ''}</p>
          <section aria-labelledby="about-book"><h2 id="about-book">About this book</h2><p className="book-description">{book.description?.trim() || 'A description has not been added yet.'}</p></section>
          <p className="muted">{book.isPremium ? 'The description is free to read. Reading the chapters requires a subscription or purchase.' : 'Free to read with your Zita account.'}</p>
          <div className="book-details-actions"><Link className="button button-dark" href={signedIn ? readPath : `/login?next=${encodeURIComponent(readPath)}`}>{signedIn ? 'Read book' : 'Sign in to read'}</Link><Link className="button button-light" href="/community">Join the community</Link></div>
        </div>
      </main><AppNav active="explore" /></div>;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}
