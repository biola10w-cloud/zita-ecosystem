# ZITA Admin Panel — Phase 4: Complete Next.js Codebase

---

## PROJECT STRUCTURE

```
zita-admin/
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── middleware.ts                    ← Route protection
├── app/
│   ├── layout.tsx                   ← Root layout with auth provider
│   ├── globals.css
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx             ← Admin login
│   └── (dashboard)/
│       ├── layout.tsx               ← Sidebar + topbar shell
│       ├── page.tsx                 ← Dashboard overview
│       ├── books/
│       │   ├── page.tsx             ← Books list
│       │   ├── new/
│       │   │   └── page.tsx         ← Upload wizard
│       │   └── [id]/
│       │       └── page.tsx         ← Edit book
│       ├── users/
│       │   └── page.tsx             ← User management
│       ├── subscriptions/
│       │   └── page.tsx             ← Subscription overview
│       ├── community/
│       │   └── page.tsx             ← Comment moderation
│       ├── analytics/
│       │   └── page.tsx             ← Analytics dashboard
│       └── translations/
│           └── page.tsx             ← Translation management
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   └── PageHeader.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   ├── Card.tsx
│   │   ├── DataTable.tsx
│   │   ├── Modal.tsx
│   │   ├── Stat.tsx
│   │   └── Toast.tsx
│   ├── books/
│   │   ├── BookUploadWizard.tsx
│   │   └── BookTable.tsx
│   ├── analytics/
│   │   ├── LineChart.tsx
│   │   ├── BarChart.tsx
│   │   └── StatsGrid.tsx
│   └── community/
│       └── ReportQueue.tsx
├── lib/
│   ├── api.ts                       ← Typed API client
│   ├── auth.ts                      ← Session management
│   └── utils.ts
└── hooks/
    ├── useAuth.ts
    ├── useToast.ts
    └── usePagination.ts
```

---

## package.json

```json
{
  "name": "zita-admin",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "recharts": "^2.10.3",
    "jose": "^5.2.2",
    "clsx": "^2.1.0",
    "date-fns": "^3.3.1",
    "react-dropzone": "^14.2.3",
    "sonner": "^1.4.3"
  },
  "devDependencies": {
    "@types/node": "^20.11.10",
    "@types/react": "^18.2.55",
    "@types/react-dom": "^18.2.19",
    "autoprefixer": "^10.4.17",
    "eslint": "^8.56.0",
    "eslint-config-next": "14.1.0",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.3.3"
  }
}
```

---

## middleware.ts

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('zita_admin_token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Verify JWT with public key
    // In production: load from env / secrets manager
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
    );

    const { payload } = await jwtVerify(token, secret);

    // Only ADMIN role can access the admin panel
    if (payload.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

---

## lib/api.ts

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.zita.app/api/v1';

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  const json = await res.json();

  if (!json.success) {
    throw new ApiError(res.status, json.error?.code, json.error?.message);
  }

  return json.data as T;
}

// ─── Auth ─────────────────────────────────────────────────────

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ accessToken: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, deviceFingerprint: 'admin-panel', platform: 'WEB' }),
      }),

    me: () => request<any>('/auth/me'),
    logout: () => request('/auth/logout', { method: 'POST' }),
  },

  // ─── Books ──────────────────────────────────────────────────

  books: {
    list: (page = 1, limit = 20) =>
      request<{ books: any[]; pagination: any }>(`/books?page=${page}&limit=${limit}`),

    get: (slug: string) => request<any>(`/books/${slug}`),

    create: (formData: FormData) =>
      fetch(`${BASE_URL}/admin/books`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      }).then((r) => r.json()),

    publish: (id: string) =>
      request(`/admin/books/${id}/publish`, { method: 'PUT' }),

    requestTranslation: (bookId: string, targetLanguage: string) =>
      request('/admin/translations', {
        method: 'POST',
        body: JSON.stringify({ bookId, targetLanguage }),
      }),
  },

  // ─── Users ──────────────────────────────────────────────────

  users: {
    list: (page = 1, limit = 20, search?: string) =>
      request<{ users: any[]; pagination: any }>(
        `/admin/users?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),

    updateRole: (id: string, role: string) =>
      request(`/admin/users/${id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      }),
  },

  // ─── Subscriptions ──────────────────────────────────────────

  subscriptions: {
    plans: () => request<any[]>('/subscriptions/plans'),
  },

  // ─── Analytics ──────────────────────────────────────────────

  analytics: {
    dashboard: (days = 30) =>
      request<any>(`/analytics/dashboard?days=${days}`),
  },

  // ─── Community ──────────────────────────────────────────────

  community: {
    reports: (status = 'PENDING', page = 1) =>
      request<{ reports: any[]; pagination: any }>(
        `/admin/reports?status=${status}&page=${page}`,
      ),

    reviewReport: (id: string, action: 'ACTIONED' | 'DISMISSED') =>
      request(`/admin/reports/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ action }),
      }),
  },
};
```

---

## app/globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

:root {
  --primary:      #1A1A2E;
  --accent:       #E8B84B;
  --accent-soft:  #FDF3DC;
  --surface:      #F7F6F3;
  --card:         #FFFFFF;
  --border:       #E8E6E1;
  --text:         #1A1A2E;
  --muted:        #6B6B8A;
  --success:      #2ECC71;
  --error:        #E74C3C;
  --warning:      #F39C12;
}

* { box-sizing: border-box; }

body {
  font-family: 'DM Sans', sans-serif;
  background: var(--surface);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}

.font-display { font-family: 'Lora', serif; }
.font-mono    { font-family: 'DM Mono', monospace; }

/* Scrollbar */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

/* Focus ring */
*:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}
```

---

## tailwind.config.ts

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary:     '#1A1A2E',
        accent:      '#E8B84B',
        'accent-soft': '#FDF3DC',
        surface:     '#F7F6F3',
        border:      '#E8E6E1',
        muted:       '#6B6B8A',
      },
      fontFamily: {
        sans:    ['DM Sans', 'sans-serif'],
        display: ['Lora', 'serif'],
        mono:    ['DM Mono', 'monospace'],
      },
      boxShadow: {
        card:  '0 1px 3px rgba(26,26,46,0.06), 0 4px 12px rgba(26,26,46,0.04)',
        modal: '0 20px 60px rgba(26,26,46,0.15)',
        btn:   '0 2px 8px rgba(232,184,75,0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## app/layout.tsx

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ZITA Admin',
  description: 'ZITA Reading Ecosystem — Admin Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

---

## app/(auth)/login/page.tsx

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { accessToken } = await api.auth.login(email, password);

      // Store token in httpOnly cookie via API route
      document.cookie = `zita_admin_token=${accessToken}; path=/; SameSite=Strict; Secure`;

      router.push('/');
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-6">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full
          bg-accent/5 blur-[120px] translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full
          bg-accent/5 blur-[100px] -translate-x-1/3 translate-y-1/3" />
      </div>

      <div className="relative w-full max-w-[400px]">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center
            font-bold text-xl text-primary font-display">Z</div>
          <div>
            <div className="text-white font-bold text-xl tracking-[3px]">ZITA</div>
            <div className="text-white/40 text-xs tracking-widest">ADMIN PANEL</div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
          <h1 className="text-white text-2xl font-bold mb-1">Welcome back</h1>
          <p className="text-white/50 text-sm mb-8">Sign in to the admin dashboard</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-white/60 text-xs font-medium block mb-2 tracking-wide">
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white/8 border border-white/10 rounded-xl px-4 py-3
                  text-white text-sm placeholder:text-white/30
                  focus:outline-none focus:border-accent/50 focus:bg-white/10
                  transition-all duration-200"
                placeholder="admin@zita.app"
              />
            </div>

            <div>
              <label className="text-white/60 text-xs font-medium block mb-2 tracking-wide">
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-white/8 border border-white/10 rounded-xl px-4 py-3
                  text-white text-sm placeholder:text-white/30
                  focus:outline-none focus:border-accent/50 focus:bg-white/10
                  transition-all duration-200"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3
                text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent/90 text-primary font-bold
                py-3 rounded-xl transition-all duration-200 shadow-btn
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-primary/30 border-t-primary
                  rounded-full animate-spin" />
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-white/20 text-xs mt-6">
          ZITA Admin · Authorised personnel only
        </p>
      </div>
    </div>
  );
}
```

---

## app/(dashboard)/layout.tsx

```tsx
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
```

---

## components/layout/Sidebar.tsx

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const nav = [
  { href: '/',               icon: '◈',  label: 'Overview' },
  { href: '/books',          icon: '📚', label: 'Books' },
  { href: '/users',          icon: '👥', label: 'Users' },
  { href: '/subscriptions',  icon: '💳', label: 'Subscriptions' },
  { href: '/community',      icon: '💬', label: 'Community' },
  { href: '/analytics',      icon: '📊', label: 'Analytics' },
  { href: '/translations',   icon: '🌐', label: 'Translations' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] h-screen bg-primary flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/8">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center
            font-bold text-sm text-primary font-display">Z</div>
          <div>
            <div className="text-white font-bold text-sm tracking-[2px]">ZITA</div>
            <div className="text-white/30 text-[10px] tracking-widest">ADMIN</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, icon, label }) => {
          const isActive = href === '/'
            ? pathname === '/'
            : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-accent text-primary'
                  : 'text-white/50 hover:text-white hover:bg-white/6',
              )}
            >
              <span className="text-base w-5 text-center">{icon}</span>
              <span>{label}</span>
              {label === 'Community' && (
                <span className="ml-auto bg-red-500 text-white text-[10px]
                  font-bold px-1.5 py-0.5 rounded-full">3</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/8">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl
          text-white/40 text-sm cursor-pointer hover:text-white/70 transition-colors">
          <span>⬡</span>
          <span className="text-xs">admin@zita.app</span>
        </div>
      </div>
    </aside>
  );
}
```

---

## components/layout/Topbar.tsx

```tsx
'use client';

import { usePathname } from 'next/navigation';

const titles: Record<string, string> = {
  '/':               'Overview',
  '/books':          'Books',
  '/books/new':      'Upload Book',
  '/users':          'Users',
  '/subscriptions':  'Subscriptions',
  '/community':      'Community',
  '/analytics':      'Analytics',
  '/translations':   'Translations',
};

export function Topbar() {
  const pathname = usePathname();
  const title = titles[pathname] ?? 'ZITA Admin';

  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm
      flex items-center justify-between px-6 shrink-0">
      <h1 className="font-bold text-primary text-base">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            placeholder="Search…"
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm
              w-48 placeholder:text-muted focus:outline-none focus:border-accent/40
              transition-colors"
          />
        </div>
        <div className="w-8 h-8 bg-primary rounded-full flex items-center
          justify-center text-accent text-xs font-bold font-display">A</div>
      </div>
    </header>
  );
}
```

---

## app/(dashboard)/page.tsx — Overview Dashboard

```tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { StatsGrid } from '@/components/analytics/StatsGrid';
import { LineChart } from '@/components/analytics/LineChart';
import { BarChart } from '@/components/analytics/BarChart';
import { formatNumber } from '@/lib/utils';

export default function OverviewPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.analytics.dashboard(30)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  const { overview, topBooks, dailyActiveUsers } = stats ?? {};

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-primary font-display">
          Good morning, Admin
        </h2>
        <p className="text-muted text-sm mt-1">
          Here's what's happening on ZITA today.
        </p>
      </div>

      {/* KPI Stats */}
      <StatsGrid
        stats={[
          {
            label: 'Total Users',
            value: formatNumber(overview?.totalUsers ?? 0),
            delta: '+12%',
            positive: true,
            icon: '👥',
          },
          {
            label: 'Active Subscriptions',
            value: formatNumber(overview?.activeSubscriptions ?? 0),
            delta: '+8%',
            positive: true,
            icon: '💳',
          },
          {
            label: 'Free Trials',
            value: formatNumber(overview?.trialSubscriptions ?? 0),
            delta: '+24%',
            positive: true,
            icon: '⏳',
          },
          {
            label: 'Reading Sessions',
            value: formatNumber(overview?.totalReadingEvents ?? 0),
            delta: '+5%',
            positive: true,
            icon: '📖',
          },
          {
            label: 'New Users (30d)',
            value: formatNumber(overview?.newUsersThisPeriod ?? 0),
            delta: '-3%',
            positive: false,
            icon: '🆕',
          },
        ]}
      />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h3 className="font-bold text-primary mb-4">Daily Active Users</h3>
          <LineChart
            data={dailyActiveUsers ?? []}
            xKey="date"
            yKey="active_users"
            color="#E8B84B"
          />
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h3 className="font-bold text-primary mb-4">Top Books (30 days)</h3>
          <BarChart
            data={(topBooks ?? []).slice(0, 6).map((b: any) => ({
              name: b.title?.slice(0, 20) + (b.title?.length > 20 ? '…' : ''),
              reads: b.readCount ?? 0,
            }))}
            xKey="name"
            yKey="reads"
            color="#1A1A2E"
          />
        </div>
      </div>

      {/* Top books table */}
      <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-bold text-primary">Trending Books</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface/50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">#</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Book</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Author</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Reads</th>
            </tr>
          </thead>
          <tbody>
            {(topBooks ?? []).slice(0, 8).map((book: any, i: number) => (
              <tr key={book.id ?? i}
                className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                <td className="px-5 py-3.5 text-muted text-sm">{i + 1}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-10 bg-primary/10 rounded-lg flex items-center
                      justify-center text-base shrink-0">📖</div>
                    <span className="font-medium text-primary text-sm">{book.title}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-muted text-sm">{book.authorName}</td>
                <td className="px-5 py-3.5 text-right">
                  <span className="font-mono text-sm font-medium text-primary">
                    {formatNumber(book.readCount ?? 0)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl animate-pulse">
      <div className="h-8 bg-border rounded-lg w-64" />
      <div className="grid grid-cols-5 gap-4">
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className="h-28 bg-border rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-5">
        <div className="h-72 bg-border rounded-2xl" />
        <div className="h-72 bg-border rounded-2xl" />
      </div>
    </div>
  );
}
```

---

## components/analytics/StatsGrid.tsx

```tsx
import clsx from 'clsx';

interface Stat {
  label:    string;
  value:    string;
  delta:    string;
  positive: boolean;
  icon:     string;
}

export function StatsGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-card border border-border rounded-2xl p-4 shadow-card"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xl">{stat.icon}</span>
            <span className={clsx(
              'text-xs font-semibold px-2 py-0.5 rounded-full',
              stat.positive
                ? 'bg-green-50 text-green-600'
                : 'bg-red-50 text-red-500',
            )}>
              {stat.delta}
            </span>
          </div>
          <div className="text-2xl font-bold text-primary">{stat.value}</div>
          <div className="text-xs text-muted mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
```

---

## components/analytics/LineChart.tsx

```tsx
'use client';

import {
  ResponsiveContainer,
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface Props {
  data:   any[];
  xKey:   string;
  yKey:   string;
  color?: string;
}

export function LineChart({ data, xKey, yKey, color = '#E8B84B' }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ReLineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8E6E1" vertical={false} />
        <XAxis
          dataKey={xKey}
          tickFormatter={(v) => {
            try { return format(parseISO(v), 'MMM d'); } catch { return v; }
          }}
          tick={{ fontSize: 11, fill: '#6B6B8A' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6B6B8A' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: '#1A1A2E',
            border: 'none',
            borderRadius: '10px',
            color: '#fff',
            fontSize: '12px',
          }}
        />
        <Line
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
      </ReLineChart>
    </ResponsiveContainer>
  );
}
```

---

## components/analytics/BarChart.tsx

```tsx
'use client';

import {
  ResponsiveContainer,
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

interface Props {
  data:   any[];
  xKey:   string;
  yKey:   string;
  color?: string;
}

export function BarChart({ data, xKey, yKey, color = '#1A1A2E' }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ReBarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8E6E1" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: '#6B6B8A' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6B6B8A' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: '#1A1A2E',
            border: 'none',
            borderRadius: '10px',
            color: '#fff',
            fontSize: '12px',
          }}
          cursor={{ fill: 'rgba(26,26,46,0.05)' }}
        />
        <Bar dataKey={yKey} radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={i === 0 ? '#E8B84B' : color}
              fillOpacity={i === 0 ? 1 : 0.7}
            />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  );
}
```

---

## app/(dashboard)/books/page.tsx

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

export default function BooksPage() {
  const [books, setBooks]     = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);

  useEffect(() => {
    api.books.list(page, 20)
      .then(({ books, pagination }) => {
        setBooks(books);
        setPagination(pagination);
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="max-w-7xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-primary font-display">Books</h2>
          <p className="text-muted text-sm">
            {pagination?.total ?? 0} total books in the library
          </p>
        </div>
        <Link
          href="/books/new"
          className="bg-primary text-white font-semibold text-sm px-4 py-2.5
            rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <span>+</span> Upload Book
        </Link>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface/50">
              {['Book', 'Type', 'Language', 'Status', 'Premium', 'Chapters', 'Actions'].map((h) => (
                <th key={h}
                  className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(8).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array(7).fill(0).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-border rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : books.map((book) => (
                  <tr key={book.id}
                    className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-10 bg-primary/8 rounded-lg flex items-center
                          justify-center text-sm shrink-0">📖</div>
                        <div>
                          <div className="font-medium text-primary text-sm leading-snug">
                            {book.title}
                          </div>
                          <div className="text-muted text-xs">{book.authorName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-medium text-primary/70 bg-primary/8
                        px-2 py-1 rounded-lg">{book.contentType}</span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted uppercase text-xs">
                      {book.language}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full
                        ${book.isPublished
                          ? 'bg-green-50 text-green-600'
                          : 'bg-amber-50 text-amber-600'}`}>
                        {book.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted">
                      {book.isPremium ? '✦ Yes' : 'Free'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-sm text-muted">
                      {book.totalChapters}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Link href={`/books/${book.id}`}
                          className="text-xs font-medium text-accent hover:underline">
                          Edit
                        </Link>
                        {!book.isPublished && (
                          <button
                            onClick={() => api.books.publish(book.id).then(() =>
                              setBooks(b => b.map(bk =>
                                bk.id === book.id ? { ...bk, isPublished: true } : bk
                              ))
                            )}
                            className="text-xs font-medium text-green-600 hover:underline">
                            Publish
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-border">
            <span className="text-sm text-muted">
              Page {pagination.page} of {pagination.pages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-border rounded-lg
                  disabled:opacity-40 hover:bg-surface transition-colors"
              >← Prev</button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="px-3 py-1.5 text-sm border border-border rounded-lg
                  disabled:opacity-40 hover:bg-surface transition-colors"
              >Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## app/(dashboard)/books/new/page.tsx — Upload Wizard

```tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { api } from '@/lib/api';
import clsx from 'clsx';

type Step = 'metadata' | 'files' | 'review' | 'processing';

const LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' }, { code: 'de', name: 'German' },
  { code: 'ar', name: 'Arabic' },  { code: 'pt', name: 'Portuguese' },
  { code: 'sw', name: 'Swahili' }, { code: 'zh', name: 'Chinese' },
];

export default function NewBookPage() {
  const router = useRouter();
  const [step, setStep]       = useState<Step>('metadata');
  const [error, setError]     = useState('');
  const [jobId, setJobId]     = useState('');
  const [bookId, setBookId]   = useState('');

  const [metadata, setMetadata] = useState({
    title: '', authorName: '', description: '',
    contentType: 'BOOK', language: 'en',
    estimatedMinutes: 60, isPremium: true, price: '',
    tags: '',
  });

  const [contentFile, setContentFile] = useState<File | null>(null);
  const [coverFile,   setCoverFile]   = useState<File | null>(null);

  // ─── Dropzone: content file ──────────────────────────────────

  const onContentDrop = useCallback((files: File[]) => {
    setContentFile(files[0] ?? null);
  }, []);

  const { getRootProps: getContentProps, getInputProps: getContentInput, isDragActive: isContentDrag } =
    useDropzone({
      onDrop: onContentDrop,
      accept: { 'text/plain': ['.txt'], 'text/markdown': ['.md'] },
      maxFiles: 1,
    });

  // ─── Dropzone: cover image ───────────────────────────────────

  const onCoverDrop = useCallback((files: File[]) => {
    setCoverFile(files[0] ?? null);
  }, []);

  const { getRootProps: getCoverProps, getInputProps: getCoverInput, isDragActive: isCoverDrag } =
    useDropzone({
      onDrop: onCoverDrop,
      accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
      maxFiles: 1,
    });

  // ─── Submit ──────────────────────────────────────────────────

  async function handleSubmit() {
    if (!contentFile || !coverFile) {
      setError('Both content file and cover image are required');
      return;
    }

    setStep('processing');
    setError('');

    const formData = new FormData();
    formData.append('metadata', JSON.stringify({
      ...metadata,
      estimatedMinutes: Number(metadata.estimatedMinutes),
      isPremium: metadata.isPremium,
      price: metadata.price ? Number(metadata.price) : undefined,
      tags: metadata.tags.split(',').map((t) => t.trim()).filter(Boolean),
    }));
    formData.append('content', contentFile);
    formData.append('cover', coverFile);

    try {
      const result = await api.books.create(formData);

      if (!result.success) {
        setError(result.error?.message ?? 'Upload failed');
        setStep('review');
        return;
      }

      setJobId(result.data.encryptionJobId);
      setBookId(result.data.book.id);
    } catch (err: any) {
      setError(err.message ?? 'Upload failed');
      setStep('review');
    }
  }

  // ─── Render ──────────────────────────────────────────────────

  const steps = ['metadata', 'files', 'review', 'processing'];
  const stepIdx = steps.indexOf(step);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-primary font-display">Upload New Book</h2>
        <p className="text-muted text-sm mt-1">
          Content is automatically encrypted with AES-256-GCM before storage.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {['Metadata', 'Files', 'Review', 'Processing'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={clsx(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              i < stepIdx  ? 'bg-green-500 text-white' :
              i === stepIdx ? 'bg-accent text-primary' :
              'bg-border text-muted',
            )}>
              {i < stepIdx ? '✓' : i + 1}
            </div>
            <span className={clsx(
              'text-sm hidden sm:block',
              i === stepIdx ? 'font-semibold text-primary' : 'text-muted',
            )}>{s}</span>
            {i < 3 && <div className="w-8 h-px bg-border mx-1" />}
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 shadow-card">

        {/* ─── Step 1: Metadata ─── */}
        {step === 'metadata' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-primary">Book Details</h3>

            <Field label="Title">
              <input value={metadata.title}
                onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                className={inputCls}
                placeholder="e.g. Things Fall Apart"
              />
            </Field>

            <Field label="Author Name">
              <input value={metadata.authorName}
                onChange={(e) => setMetadata({ ...metadata, authorName: e.target.value })}
                className={inputCls}
                placeholder="e.g. Chinua Achebe"
              />
            </Field>

            <Field label="Description">
              <textarea value={metadata.description}
                onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
                className={inputCls + ' h-28 resize-none'}
                placeholder="A brief synopsis of the book..."
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Content Type">
                <select value={metadata.contentType}
                  onChange={(e) => setMetadata({ ...metadata, contentType: e.target.value })}
                  className={inputCls}>
                  <option value="BOOK">Book</option>
                  <option value="STORY">Story</option>
                  <option value="SUMMARY">Summary</option>
                </select>
              </Field>

              <Field label="Language">
                <select value={metadata.language}
                  onChange={(e) => setMetadata({ ...metadata, language: e.target.value })}
                  className={inputCls}>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Est. Reading Time (mins)">
                <input type="number" value={metadata.estimatedMinutes}
                  onChange={(e) => setMetadata({ ...metadata, estimatedMinutes: Number(e.target.value) })}
                  className={inputCls}
                  min={1}
                />
              </Field>

              <Field label="Price (USD, blank = sub only)">
                <input type="number" value={metadata.price}
                  onChange={(e) => setMetadata({ ...metadata, price: e.target.value })}
                  className={inputCls}
                  placeholder="Leave blank for subscription"
                  min={0} step={0.01}
                />
              </Field>
            </div>

            <Field label="Tags (comma-separated)">
              <input value={metadata.tags}
                onChange={(e) => setMetadata({ ...metadata, tags: e.target.value })}
                className={inputCls}
                placeholder="fiction, africa, classic"
              />
            </Field>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setMetadata({ ...metadata, isPremium: !metadata.isPremium })}
                className={clsx(
                  'relative w-11 h-6 rounded-full transition-colors',
                  metadata.isPremium ? 'bg-accent' : 'bg-border',
                )}
              >
                <div className={clsx(
                  'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                  metadata.isPremium ? 'translate-x-5' : 'translate-x-0.5',
                )} />
              </button>
              <span className="text-sm text-primary">Premium content (subscription required)</span>
            </div>

            <div className="pt-2 flex justify-end">
              <button onClick={() => setStep('files')}
                disabled={!metadata.title || !metadata.authorName}
                className={btnPrimary}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 2: Files ─── */}
        {step === 'files' && (
          <div className="space-y-5">
            <h3 className="font-semibold text-primary">Upload Files</h3>

            <div>
              <label className={labelCls}>Book Content (.txt or .md)</label>
              <div {...getContentProps()} className={clsx(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                isContentDrag ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/40',
                contentFile && 'border-green-400 bg-green-50',
              )}>
                <input {...getContentInput()} />
                {contentFile ? (
                  <div className="text-green-600">
                    <div className="text-2xl mb-2">✓</div>
                    <div className="font-medium text-sm">{contentFile.name}</div>
                    <div className="text-xs text-muted mt-1">
                      {(contentFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ) : (
                  <div className="text-muted">
                    <div className="text-3xl mb-3">📄</div>
                    <div className="text-sm font-medium text-primary">
                      Drop your .txt or .md file here
                    </div>
                    <div className="text-xs mt-1">
                      Chapters should be separated by <code className="bg-surface px-1 rounded">
                      === CHAPTER N ===</code> markers
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className={labelCls}>Cover Image (JPG, PNG, WebP)</label>
              <div {...getCoverProps()} className={clsx(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                isCoverDrag ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/40',
                coverFile && 'border-green-400 bg-green-50',
              )}>
                <input {...getCoverInput()} />
                {coverFile ? (
                  <div className="text-green-600">
                    <div className="text-2xl mb-2">✓</div>
                    <div className="font-medium text-sm">{coverFile.name}</div>
                    <div className="text-xs text-muted mt-1">
                      {(coverFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ) : (
                  <div className="text-muted">
                    <div className="text-3xl mb-3">🖼️</div>
                    <div className="text-sm font-medium text-primary">Drop cover image here</div>
                    <div className="text-xs mt-1">Recommended: 400×600px (2:3 ratio)</div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep('metadata')}
                className="text-sm text-muted hover:text-primary transition-colors">
                ← Back
              </button>
              <button onClick={() => setStep('review')}
                disabled={!contentFile || !coverFile}
                className={btnPrimary}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Review ─── */}
        {step === 'review' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-primary">Review & Submit</h3>

            <div className="bg-surface rounded-xl p-4 space-y-2 text-sm">
              {[
                ['Title',    metadata.title],
                ['Author',   metadata.authorName],
                ['Type',     metadata.contentType],
                ['Language', LANGUAGES.find(l => l.code === metadata.language)?.name],
                ['Duration', `${metadata.estimatedMinutes} mins`],
                ['Premium',  metadata.isPremium ? 'Yes' : 'No'],
                ['Price',    metadata.price ? `$${metadata.price}` : 'Subscription only'],
                ['Content',  contentFile?.name],
                ['Cover',    coverFile?.name],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted">{k}</span>
                  <span className="font-medium text-primary">{v}</span>
                </div>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
              ⚡ After submission, the book will be encrypted with AES-256-GCM in the
              background. It won't be visible to users until you publish it.
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep('files')}
                className="text-sm text-muted hover:text-primary transition-colors">
                ← Back
              </button>
              <button onClick={handleSubmit} className={btnPrimary}>
                Upload & Encrypt
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 4: Processing ─── */}
        {step === 'processing' && (
          <div className="text-center py-8 space-y-4">
            {!jobId ? (
              <>
                <div className="w-12 h-12 border-4 border-accent/20 border-t-accent
                  rounded-full animate-spin mx-auto" />
                <div className="text-primary font-medium">Uploading…</div>
                <div className="text-muted text-sm">Transferring files to secure storage</div>
              </>
            ) : (
              <>
                <div className="text-5xl">🔐</div>
                <div className="text-primary font-bold text-lg">Encryption In Progress</div>
                <div className="text-muted text-sm max-w-sm mx-auto">
                  Your book is being encrypted with AES-256-GCM in the background.
                  Job ID: <code className="font-mono text-xs bg-surface px-1 rounded">{String(jobId)}</code>
                </div>
                <div className="flex gap-3 justify-center pt-2">
                  <button
                    onClick={() => api.books.publish(bookId).then(() => router.push('/books'))}
                    className={btnPrimary}>
                    Publish When Ready
                  </button>
                  <button onClick={() => router.push('/books')}
                    className="px-4 py-2 text-sm font-medium text-muted border border-border
                      rounded-xl hover:bg-surface transition-colors">
                    Back to Books
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────

const inputCls = `w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm
  text-primary focus:outline-none focus:border-accent/50 transition-colors`;

const labelCls = `text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5`;

const btnPrimary = `bg-primary text-white font-semibold text-sm px-5 py-2.5 rounded-xl
  hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}
```

---

## app/(dashboard)/users/page.tsx

```tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const ROLES = ['READER', 'MODERATOR', 'ADMIN'];

export default function UsersPage() {
  const [users, setUsers]     = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);

  function loadUsers(q = search) {
    setLoading(true);
    api.users.list(1, 20, q || undefined)
      .then(({ users, pagination }) => { setUsers(users); setPagination(pagination); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadUsers(); }, []);

  async function changeRole(id: string, role: string) {
    await api.users.updateRole(id, role);
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role } : u));
  }

  const subColors: Record<string, string> = {
    ACTIVE:    'bg-green-50 text-green-600',
    TRIALING:  'bg-blue-50 text-blue-600',
    CANCELLED: 'bg-red-50 text-red-500',
    EXPIRED:   'bg-gray-100 text-gray-500',
    PAST_DUE:  'bg-amber-50 text-amber-600',
  };

  return (
    <div className="max-w-7xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-primary font-display">Users</h2>
          <p className="text-muted text-sm">{pagination?.total ?? 0} registered users</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadUsers(search)}
            placeholder="Search by name or email…"
            className="bg-card border border-border rounded-xl px-3 py-2 text-sm
              w-56 focus:outline-none focus:border-accent/50 transition-colors"
          />
          <button onClick={() => loadUsers(search)}
            className="bg-primary text-white text-sm font-semibold px-4 py-2 rounded-xl
              hover:bg-primary/90 transition-colors">
            Search
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface/50">
              {['User', 'Role', 'Subscription', 'Joined', 'Actions'].map((h) => (
                <th key={h}
                  className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(8).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array(5).fill(0).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-border rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : users.map((user) => (
                  <tr key={user.id}
                    className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center
                          justify-center text-accent text-sm font-bold shrink-0">
                          {user.displayName?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-primary text-sm">{user.displayName}</div>
                          <div className="text-muted text-xs">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full
                        ${user.role === 'ADMIN'     ? 'bg-primary text-white' :
                          user.role === 'MODERATOR' ? 'bg-purple-50 text-purple-600' :
                          'bg-surface text-muted'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {user.subscription ? (
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full
                          ${subColors[user.subscription.status] ?? 'bg-surface text-muted'}`}>
                          {user.subscription.status}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={user.role}
                        onChange={(e) => changeRole(user.id, e.target.value)}
                        className="text-xs border border-border rounded-lg px-2 py-1
                          focus:outline-none focus:border-accent/50 bg-surface
                          text-primary cursor-pointer"
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## app/(dashboard)/community/page.tsx — Report Queue

```tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import clsx from 'clsx';

type FilterStatus = 'PENDING' | 'ACTIONED' | 'DISMISSED';

export default function CommunityPage() {
  const [reports, setReports]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<FilterStatus>('PENDING');
  const [acting, setActing]     = useState<string | null>(null);

  function loadReports(status: FilterStatus) {
    setLoading(true);
    api.community.reports(status)
      .then(({ reports }) => setReports(reports))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadReports(filter); }, [filter]);

  async function handleAction(id: string, action: 'ACTIONED' | 'DISMISSED') {
    setActing(id);
    await api.community.reviewReport(id, action);
    setReports((prev) => prev.filter((r) => r.id !== id));
    setActing(null);
  }

  const reasonColors: Record<string, string> = {
    SPAM:          'bg-red-50 text-red-500',
    HARASSMENT:    'bg-orange-50 text-orange-500',
    SPOILER:       'bg-yellow-50 text-yellow-600',
    INAPPROPRIATE: 'bg-purple-50 text-purple-500',
    OTHER:         'bg-gray-100 text-gray-500',
  };

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h2 className="text-xl font-bold text-primary font-display">Community Moderation</h2>
        <p className="text-muted text-sm">Review flagged comments from readers.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['PENDING', 'ACTIONED', 'DISMISSED'] as FilterStatus[]).map((s) => (
          <button key={s}
            onClick={() => setFilter(s)}
            className={clsx(
              'px-4 py-2 rounded-xl text-sm font-semibold transition-all',
              filter === s
                ? 'bg-primary text-white'
                : 'bg-card border border-border text-muted hover:text-primary',
            )}>
            {s}
            {s === 'PENDING' && reports.length > 0 && filter !== 'PENDING' && (
              <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {reports.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading
          ? Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-36 bg-card border border-border rounded-2xl animate-pulse" />
            ))
          : reports.length === 0
          ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <div className="text-4xl mb-3">✅</div>
              <div className="font-semibold text-primary">All clear</div>
              <div className="text-muted text-sm mt-1">No {filter.toLowerCase()} reports.</div>
            </div>
          )
          : reports.map((report) => (
              <div key={report.id}
                className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full
                      ${reasonColors[report.reason] ?? 'bg-surface text-muted'}`}>
                      {report.reason}
                    </span>
                    <span className="text-muted text-xs">
                      in <span className="font-medium text-primary">
                        {report.comment?.book?.title}
                      </span>
                    </span>
                    <span className="text-muted text-xs">·</span>
                    <span className="text-muted text-xs">{formatDate(report.createdAt)}</span>
                  </div>
                  <div className="text-xs text-muted shrink-0">
                    by {report.comment?.user?.displayName}
                  </div>
                </div>

                {/* Comment body */}
                <div className="bg-surface rounded-xl p-4 border-l-2 border-border">
                  <p className="text-sm text-primary leading-relaxed">
                    {report.comment?.body}
                  </p>
                </div>

                {/* Report details */}
                {report.details && (
                  <p className="text-xs text-muted">
                    Reporter note: <span className="italic">{report.details}</span>
                  </p>
                )}

                {/* Actions */}
                {filter === 'PENDING' && (
                  <div className="flex gap-2 pt-1">
                    <button
                      disabled={acting === report.id}
                      onClick={() => handleAction(report.id, 'ACTIONED')}
                      className="px-4 py-2 bg-red-500 text-white text-sm font-semibold
                        rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50">
                      {acting === report.id ? '…' : '✗ Remove Comment'}
                    </button>
                    <button
                      disabled={acting === report.id}
                      onClick={() => handleAction(report.id, 'DISMISSED')}
                      className="px-4 py-2 bg-surface border border-border text-muted text-sm
                        font-semibold rounded-xl hover:text-primary transition-colors
                        disabled:opacity-50">
                      ✓ Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))}
      </div>
    </div>
  );
}
```

---

## lib/utils.ts

```typescript
import { format, parseISO } from 'date-fns';

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatDate(dateStr: string | Date): string {
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    return format(d, 'MMM d, yyyy');
  } catch {
    return String(dateStr);
  }
}

export function formatDateTime(dateStr: string | Date): string {
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    return format(d, 'MMM d, yyyy HH:mm');
  } catch {
    return String(dateStr);
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
```
