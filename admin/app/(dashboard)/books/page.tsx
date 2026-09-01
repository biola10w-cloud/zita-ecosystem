import Link from 'next/link';
import { apiFetch } from '../../../lib/api';
import { getSessionToken } from '../../../lib/auth';
import { PublishButton } from './publish-button';

interface AdminBook {
  id: string;
  slug: string;
  title: string;
  authorName: string;
  contentType: string;
  isPublished: boolean;
  isPremium: boolean;
  price: string | null;
  totalChapters: number;
  encryptionStatus: 'PENDING' | 'READY';
  category: { id: string; name: string } | null;
}

export default async function BooksPage() {
  const token = getSessionToken();
  let books: AdminBook[] = [];
  let loadError: string | null = null;

  try {
    const result = await apiFetch<AdminBook[]>('/admin/books?limit=50', token);
    books = result.data;
  } catch (err: any) {
    loadError = err.message ?? 'Failed to load books';
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Books</h1>
          <p className="text-sm text-gray-500">{books.length} book(s)</p>
        </div>
        <Link
          href="/books/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-primary transition hover:opacity-90"
        >
          + Upload Book
        </Link>
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{loadError}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-400">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Author</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Encryption</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {books.map((book) => (
              <tr key={book.id}>
                <td className="px-4 py-3 font-medium text-primary">{book.title}</td>
                <td className="px-4 py-3 text-gray-500">{book.authorName}</td>
                <td className="px-4 py-3 text-gray-500">{book.category?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{book.contentType}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      book.encryptionStatus === 'READY'
                        ? 'bg-green-50 text-green-600'
                        : 'bg-yellow-50 text-yellow-600'
                    }`}
                  >
                    {book.encryptionStatus === 'READY' ? 'Ready' : 'Encrypting…'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      book.isPublished ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {book.isPublished ? 'Published' : 'Draft'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {!book.isPublished && (
                    <PublishButton bookId={book.id} disabled={book.encryptionStatus !== 'READY'} />
                  )}
                </td>
              </tr>
            ))}
            {books.length === 0 && !loadError && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  No books yet — upload your first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
