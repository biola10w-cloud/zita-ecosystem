import { useState } from 'react';

export function usePagination(initialPage = 1, limit = 20) {
  const [page, setPage]   = useState(initialPage);
  const [total, setTotal] = useState(0);
  const pages = Math.ceil(total / limit);

  return {
    page, limit, total, pages,
    setTotal,
    nextPage: () => setPage(p => Math.min(pages, p + 1)),
    prevPage: () => setPage(p => Math.max(1, p - 1)),
    goToPage: (p: number) => setPage(Math.max(1, Math.min(pages, p))),
    canNext: page < pages,
    canPrev: page > 1,
  };
}
