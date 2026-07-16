'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function BooksPage() {
  const [books, setBooks]         = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);

  useEffect(() => {
    setLoading(true);
    api.books.list(page, 20)
      .then(({ books, pagination }: any) => { setBooks(books); setPagination(pagination); })
      .finally(() => setLoading(false));
  }, [page]);

  async function publishBook(id: string) {
    await api.books.publish(id);
    setBooks(b => b.map(bk => bk.id === id ? { ...bk, isPublished: true } : bk));
  }

  return (
    <div className="max-w-7xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: '#1A1A2E', fontFamily: 'Lora, serif' }}>Books</h2>
          <p className="text-sm mt-0.5" style={{ color: '#6B6B8A' }}>{pagination?.total ?? 0} total books</p>
        </div>
        <Link href="/dashboard/books/new"
          className="text-white font-semibold text-sm px-4 py-2.5 rounded-xl no-underline
            transition-opacity hover:opacity-90"
          style={{ background: '#1A1A2E' }}>
          + Upload Book
        </Link>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E8E6E1', boxShadow: '0 1px 3px rgba(26,26,46,0.06)' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: 'rgba(247,246,243,0.6)', borderBottom: '1px solid #E8E6E1' }}>
              {['Book', 'Type', 'Lang', 'Status', 'Premium', 'Chapters', 'Actions'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: '#6B6B8A' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(6).fill(0).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(232,230,225,0.5)' }}>
                    {Array(7).fill(0).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 rounded animate-pulse" style={{ background: '#E8E6E1' }} />
                      </td>
                    ))}
                  </tr>
                ))
              : books.map(book => (
                  <tr key={book.id} style={{ borderBottom: '1px solid rgba(232,230,225,0.5)' }}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-9 rounded flex items-center justify-center text-xs shrink-0"
                          style={{ background: 'rgba(26,26,46,0.06)' }}>📖</div>
                        <div>
                          <div className="font-medium text-sm" style={{ color: '#1A1A2E' }}>{book.title}</div>
                          <div className="text-xs" style={{ color: '#6B6B8A' }}>{book.authorName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-medium px-2 py-1 rounded-lg"
                        style={{ background: 'rgba(26,26,46,0.06)', color: '#1A1A2E' }}>
                        {book.contentType}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs uppercase font-mono" style={{ color: '#6B6B8A' }}>
                      {book.language}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full"
                        style={{
                          background: book.isPublished ? '#E8F5E9' : '#FFF8E1',
                          color:      book.isPublished ? '#2ECC71'  : '#F39C12',
                        }}>
                        {book.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold" style={{ color: '#E8B84B' }}>
                      {book.isPremium ? '✦ Yes' : <span style={{ color: '#6B6B8A', fontWeight: 400 }}>Free</span>}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-sm" style={{ color: '#6B6B8A' }}>
                      {book.totalChapters}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Link href={`/dashboard/books/edit?id=${book.id}`}
                          className="text-xs font-semibold no-underline" style={{ color: '#E8B84B' }}>
                          Edit
                        </Link>
                        {!book.isPublished && (
                          <button onClick={() => publishBook(book.id)}
                            className="text-xs font-semibold border-none bg-transparent cursor-pointer p-0"
                            style={{ color: '#2ECC71' }}>
                            Publish
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-4" style={{ borderTop: '1px solid #E8E6E1' }}>
            <span className="text-sm" style={{ color: '#6B6B8A' }}>
              Page {pagination.page} of {pagination.pages}
            </span>
            <div className="flex gap-2">
              {[['← Prev', page - 1, page === 1], ['Next →', page + 1, page === pagination.pages]].map(([label, next, disabled]) => (
                <button key={label as string}
                  onClick={() => !disabled && setPage(next as number)}
                  disabled={disabled as boolean}
                  className="px-3 py-1.5 text-sm rounded-lg transition-colors"
                  style={{ border: '1px solid #E8E6E1', opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer', background: 'white', color: '#1A1A2E' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

