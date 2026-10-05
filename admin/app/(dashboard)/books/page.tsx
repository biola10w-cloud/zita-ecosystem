import Link from 'next/link';
import { apiFetch } from '../../../lib/api';
import { getSessionToken } from '../../../lib/auth';
import { PublishButton } from './publish-button';
import { DeleteButton } from './delete-button';

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
  categories: { id: string; name: string }[];
  category: { id: string; name: string } | null;
}

export default async function BooksPage({ searchParams }: { searchParams: { page?: string; search?: string } }) {
  const requestedPage = Number(searchParams.page ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const search = typeof searchParams.search === 'string' ? searchParams.search.slice(0, 200) : '';
  const token = getSessionToken();
  let books: AdminBook[] = [];
  let total = 0;
  let pages = 0;
  let loadError: string | null = null;

  try {
    const query = new URLSearchParams({ limit: '20', page: String(page), search });
    const result = await apiFetch<AdminBook[]>(`/admin/books?${query}`, token);
    books = result.data;
    total = result.meta?.total ?? books.length;
    pages = result.meta?.pages ?? 1;
  } catch (err: any) {
    loadError = err.message ?? 'Failed to load books';
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Books</h1>
          <p className="text-sm text-gray-500">{total} book(s)</p>
        </div>
        <Link
          href="/books/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-primary transition hover:opacity-90"
        >
          + Upload Book
        </Link>
      </div>

      <form action="/books" className="mb-4 flex gap-2"><input aria-label="Search books by title or author" name="search" defaultValue={search} maxLength={200} placeholder="Search title or author" className="rounded-lg border px-3 py-2 text-sm" /><button className="rounded-lg bg-primary px-4 py-2 text-sm text-white">Search</button></form>
      {loadError && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{loadError}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-400">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Author</th>
              <th className="px-4 py-3">Categories</th>
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
                <td className="px-4 py-3 text-gray-500">{book.categories?.map((category) => category.name).join(', ') || book.category?.name || '—'}</td>
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
                  <Link href={`/books/${encodeURIComponent(book.id)}/edit`} className="mr-2 text-sm font-medium text-primary hover:underline">Edit</Link>
                  <DeleteButton bookId={book.id} title={book.title} />
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
      <nav aria-label="Books pagination" className="mt-4 flex items-center gap-4 text-sm">
        {page > 1 && <Link href={`/books?${new URLSearchParams({ page: String(page - 1), search })}`}>Previous</Link>}
        <span>Page {page} of {Math.max(1, pages)}</span>
        {page < pages && <Link href={`/books?${new URLSearchParams({ page: String(page + 1), search })}`}>Next</Link>}
      </nav>
    </div>
  );
}
