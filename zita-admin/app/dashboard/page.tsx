'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { StatsGrid } from '@/components/analytics/StatsGrid';
import { LineChart } from '@/components/analytics/LineChart';
import { BarChart } from '@/components/analytics/BarChart';
import { formatNumber, formatDate } from '@/lib/utils';

export default function OverviewPage() {
  const [stats, setStats]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.analytics.dashboard(30)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl animate-pulse">
        <div className="h-8 rounded-lg w-64" style={{ background: '#E8E6E1' }} />
        <div className="grid grid-cols-5 gap-4">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl" style={{ background: '#E8E6E1' }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-5">
          {[0,1].map(i => <div key={i} className="h-72 rounded-2xl" style={{ background: '#E8E6E1' }} />)}
        </div>
      </div>
    );
  }

  const { overview, topBooks, dailyActiveUsers } = stats ?? {};

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: '#1A1A2E', fontFamily: 'Lora, serif' }}>
          Good morning, Admin
        </h2>
        <p className="text-sm mt-1" style={{ color: '#6B6B8A' }}>
          Here's what's happening on ZITA today.
        </p>
      </div>

      <StatsGrid stats={[
        { label: 'Total Users',        value: formatNumber(overview?.totalUsers ?? 0),          delta: '+12%', positive: true,  icon: '👥' },
        { label: 'Active Subs',        value: formatNumber(overview?.activeSubscriptions ?? 0),  delta: '+8%',  positive: true,  icon: '💳' },
        { label: 'Free Trials',        value: formatNumber(overview?.trialSubscriptions ?? 0),   delta: '+24%', positive: true,  icon: '⏳' },
        { label: 'Reading Sessions',   value: formatNumber(overview?.totalReadingEvents ?? 0),   delta: '+5%',  positive: true,  icon: '📖' },
        { label: 'New Users (30d)',     value: formatNumber(overview?.newUsersThisPeriod ?? 0),  delta: '-3%',  positive: false, icon: '🆕' },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #E8E6E1', boxShadow: '0 1px 3px rgba(26,26,46,0.06)' }}>
          <h3 className="font-bold mb-4" style={{ color: '#1A1A2E' }}>Daily Active Users</h3>
          <LineChart data={dailyActiveUsers ?? []} xKey="date" yKey="active_users" color="#E8B84B" />
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #E8E6E1', boxShadow: '0 1px 3px rgba(26,26,46,0.06)' }}>
          <h3 className="font-bold mb-4" style={{ color: '#1A1A2E' }}>Top Books (30 days)</h3>
          <BarChart
            data={(topBooks ?? []).slice(0, 6).map((b: any) => ({
              name:  b.title?.slice(0, 18) + (b.title?.length > 18 ? '…' : ''),
              reads: b.readCount ?? 0,
            }))}
            xKey="name" yKey="reads" color="#1A1A2E"
          />
        </div>
      </div>

      {/* Trending table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E8E6E1', boxShadow: '0 1px 3px rgba(26,26,46,0.06)' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #E8E6E1' }}>
          <h3 className="font-bold" style={{ color: '#1A1A2E' }}>Trending Books</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr style={{ background: 'rgba(247,246,243,0.6)', borderBottom: '1px solid #E8E6E1' }}>
              {['#', 'Book', 'Author', 'Type', 'Reads'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: '#6B6B8A' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(topBooks ?? []).slice(0, 8).map((book: any, i: number) => (
              <tr key={book.id ?? i} style={{ borderBottom: '1px solid rgba(232,230,225,0.5)' }}>
                <td className="px-5 py-3.5 text-sm" style={{ color: '#6B6B8A' }}>{i + 1}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-9 rounded flex items-center justify-center text-xs shrink-0"
                      style={{ background: 'rgba(26,26,46,0.06)' }}>📖</div>
                    <span className="font-medium text-sm" style={{ color: '#1A1A2E' }}>{book.title}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-sm" style={{ color: '#6B6B8A' }}>{book.authorName}</td>
                <td className="px-5 py-3.5">
                  <span className="text-xs font-semibold px-2 py-1 rounded-full"
                    style={{ background: 'rgba(26,26,46,0.06)', color: '#1A1A2E' }}>
                    {book.contentType ?? 'BOOK'}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-sm font-mono font-medium" style={{ color: '#1A1A2E' }}>
                  {formatNumber(book.readCount ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
