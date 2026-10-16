import { notFound } from 'next/navigation';
import { Reader } from '@/components/reader';
import type { Book } from '@/components/library';
import { apiFetch, ApiError } from '@/lib/api';
import { hasReaderSession } from '@/lib/session';

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const book = await apiFetch<Book & { totalChapters: number }>(`/books/${encodeURIComponent(slug)}`);
    return <Reader key={book.id} book={book} signedIn={await hasReaderSession()} />;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}
