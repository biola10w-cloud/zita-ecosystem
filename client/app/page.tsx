import { Library, type Book } from '@/components/library';
import { apiFetch } from '@/lib/api';
import { getSessionToken } from '@/lib/session';

interface Category { id: string; name: string; slug: string; icon?: string | null; bookCount: number; }

export default async function HomePage() {
  let books: Book[] = [];
  let categories: Category[] = [];
  try {
    const [booksResult, categoryResult] = await Promise.all([
      apiFetch<Book[]>('/books?limit=100'),
      apiFetch<Category[]>('/books/categories'),
    ]);
    books = booksResult;
    categories = categoryResult;
  } catch {
    // The catalog remains empty until the backend is configured for this environment.
  }

  return <Library books={books} categories={categories} signedIn={Boolean(getSessionToken())} />;
}
