import { Library, type Book } from '@/components/library';
import { apiFetch } from '@/lib/api';
import { hasReaderSession } from '@/lib/session';

interface Category { id: string; name: string; slug: string; icon?: string | null; bookCount: number; }

export async function HomeContent({ explore = false }: { explore?: boolean }) {
  let books: Book[] = [];
  let categories: Category[] = [];
  let featured: Book[] = [];
  let error = '';
  try {
    const [booksResult, categoryResult, featuredResult] = await Promise.all([
      apiFetch<Book[]>('/books?limit=24'),
      apiFetch<Category[]>('/books/categories').catch(() => []),
      apiFetch<Book[]>('/books/featured').catch(() => []),
    ]);
    books = booksResult;
    categories = categoryResult;
    featured = featuredResult;
  } catch {
    error = 'The library is temporarily unavailable. Please try again.';
  }

  return <Library books={books} categories={categories} featured={featured} signedIn={await hasReaderSession()} error={error} explore={explore} />;
}
