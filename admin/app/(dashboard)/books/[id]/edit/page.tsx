import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '../../../../../lib/api';
import { getSessionToken } from '../../../../../lib/auth';
import { UploadForm, type EditableBook } from '../../new/upload-form';
import type { CategoryOption } from '../../category-picker';

export default async function EditBookPage({ params }: { params: { id: string } }) {
  let book: EditableBook;
  let categories: CategoryOption[];
  try {
    const token = getSessionToken();
    const [bookResult, categoryResult] = await Promise.all([
      apiFetch<EditableBook>(`/admin/books/${encodeURIComponent(params.id)}`, token),
      apiFetch<CategoryOption[]>('/admin/categories', token),
    ]);
    book = bookResult.data; categories = categoryResult.data;
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) notFound();
    return <div role="alert" className="rounded-xl bg-red-50 p-5 text-red-700">Unable to load this book and its categories. <Link className="underline" href={`/books/${encodeURIComponent(params.id)}/edit`}>Try again</Link></div>;
  }
  return <div><Link href="/books" className="text-sm text-gray-500 hover:underline">Back to books</Link><h1 className="mb-1 mt-4 text-2xl font-bold text-primary">Edit book</h1><p className="mb-6 text-sm text-gray-500">Update book details and categories. Your changes appear in the catalog after saving.</p><UploadForm key={book.id} book={book} categories={categories} /></div>;
}
