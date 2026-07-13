'use client';

import { usePathname } from 'next/navigation';

const titles: Record<string, string> = {
  '/dashboard':               'Overview',
  '/dashboard/books':         'Books',
  '/dashboard/books/new':     'Upload Book',
  '/dashboard/users':         'Users',
  '/dashboard/subscriptions': 'Subscriptions',
  '/dashboard/community':     'Community',
  '/dashboard/analytics':     'Analytics',
  '/dashboard/translations':  'Translations',
};

export function Topbar() {
  const pathname = usePathname();
  const title    = titles[pathname] ?? 'ZITA Admin';

  return (
    <header className="h-14 flex items-center justify-between px-6 shrink-0"
      style={{ borderBottom: '1px solid #E8E6E1', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)' }}>
      <h1 className="font-bold text-base" style={{ color: '#1A1A2E' }}>{title}</h1>
      <div className="flex items-center gap-3">
        <input
          placeholder="Search…"
          className="rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none transition-colors"
          style={{ background: '#F7F6F3', border: '1px solid #E8E6E1', color: '#1A1A2E' }}
        />
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: '#1A1A2E', color: '#E8B84B' }}>
          A
        </div>
      </div>
    </header>
  );
}
