import { notFound } from 'next/navigation';
import { Reader } from '@/components/reader';
import type { Book } from '@/components/library';
import { apiFetch } from '@/lib/api';
import { getSessionToken } from '@/lib/session';

export default async function BookPage({ params }: { params: { slug: string } }) {
  try {
    const book = await apiFetch<Book & { totalChapters: number }>(`/books/${params.slug}`);
    return <Reader book={book} signedIn={Boolean(getSessionToken())} />;
  } catch {
    notFound();
  }
}
