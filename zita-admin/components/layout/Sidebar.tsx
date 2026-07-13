'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const nav = [
  { href: '/dashboard',                icon: '◈',  label: 'Overview' },
  { href: '/dashboard/books',          icon: '📚', label: 'Books' },
  { href: '/dashboard/books/new',      icon: '⬆',  label: 'Upload Book' },
  { href: '/dashboard/users',          icon: '👥', label: 'Users' },
  { href: '/dashboard/subscriptions',  icon: '💳', label: 'Subscriptions' },
  { href: '/dashboard/community',      icon: '💬', label: 'Community', badge: true },
  { href: '/dashboard/analytics',      icon: '📊', label: 'Analytics' },
  { href: '/dashboard/translations',   icon: '🌐', label: 'Translations' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-52 h-screen flex flex-col shrink-0" style={{ background: '#1A1A2E' }}>
      {/* Logo */}
      <div className="px-5 py-4 flex items-center gap-2.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center
          font-bold text-sm" style={{ background: '#E8B84B', color: '#1A1A2E' }}>
          Z
        </div>
        <div>
          <div className="text-white font-bold text-sm tracking-[2px]">ZITA</div>
          <div className="text-[9px] tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
            ADMIN
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, icon, label, badge }) => {
          const isActive = href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(href);

          return (
            <Link key={href} href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium
                transition-all no-underline"
              style={{
                background: isActive ? '#E8B84B' : 'transparent',
                color: isActive ? '#1A1A2E' : 'rgba(255,255,255,0.45)',
              }}>
              <span className="text-sm w-4 text-center">{icon}</span>
              <span>{label}</span>
              {badge && !isActive && (
                <span className="ml-auto text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: '#E74C3C' }}>
                  3
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors"
          style={{ color: 'rgba(255,255,255,0.35)' }}>
          <span>⬡</span>
          <span>admin@zita.app</span>
        </div>
      </div>
    </aside>
  );
}
