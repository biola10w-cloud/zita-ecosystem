'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/books', label: 'Books', icon: '📚' },
  { href: '/books/new', label: 'Upload Book', icon: '⬆' },
  { href: '/categories', label: 'Categories', icon: '🗂️' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-gray-200 bg-white px-4 py-6">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-extrabold text-accent">
          Z
        </div>
        <div>
          <div className="text-sm font-extrabold tracking-widest text-primary">ZITA</div>
          <div className="text-[10px] font-semibold tracking-widest text-gray-400">ADMIN</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? 'bg-accent-soft text-primary' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={handleLogout}
        className="rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-400 transition hover:bg-gray-50 hover:text-red-500"
      >
        ↩ Log out
      </button>
    </aside>
  );
}
