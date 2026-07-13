'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { LineChart } from '@/components/analytics/LineChart';
import { BarChart } from '@/components/analytics/BarChart';

export default function AnalyticsPage() {
  const [stats, setStats]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays]     = useState(30);

  useEffect(() => {
    setLoading(true);
    api.analytics.dashboard(days).then(setStats).finally(() => setLoading(false));
  }, [days]);

  const card = { background: '#fff', border: '1px solid #E8E6E1', borderRadius: 14, padding: 18, boxShadow: '0 1px 3px rgba(26,26,46,0.06)' };

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', fontFamily: 'Lora, serif' }}>Analytics</h2>
          <p style={{ fontSize: 12, color: '#6B6B8A', marginTop: 3 }}>Platform metrics overview.</p>
        </div>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          style={{ padding: '7px 12px', border: '1px solid #E8E6E1', borderRadius: 10, fontSize: 12, fontFamily: 'DM Sans, sans-serif', background: '#fff', color: '#1A1A2E', outline: 'none', cursor: 'pointer' }}>
          {[7, 14, 30, 90].map(d => <option key={d} value={d}>Last {d} days</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {Array(4).fill(0).map((_, i) => (
            <div key={i} style={{ height: 260, background: '#E8E6E1', borderRadius: 14, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { icon: '👥', label: 'Total Users',      value: formatNumber(stats?.overview?.totalUsers ?? 0) },
              { icon: '💳', label: 'Active Subs',      value: formatNumber(stats?.overview?.activeSubscriptions ?? 0) },
              { icon: '📖', label: 'Reading Sessions', value: formatNumber(stats?.overview?.totalReadingEvents ?? 0) },
              { icon: '🆕', label: 'New Users',        value: formatNumber(stats?.overview?.newUsersThisPeriod ?? 0) },
            ].map(s => (
              <div key={s.label} style={{ ...card }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>{s.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#6B6B8A', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div style={card}>
              <div style={{ fontWeight: 700, color: '#1A1A2E', fontSize: 13, marginBottom: 14 }}>Daily Active Users</div>
              <LineChart data={stats?.dailyActiveUsers ?? []} xKey="date" yKey="active_users" color="#E8B84B" />
            </div>
            <div style={card}>
              <div style={{ fontWeight: 700, color: '#1A1A2E', fontSize: 13, marginBottom: 14 }}>Top Books by Reads</div>
              <BarChart
                data={(stats?.topBooks ?? []).slice(0, 6).map((b: any) => ({
                  name:  b.title?.slice(0, 16) + (b.title?.length > 16 ? '…' : ''),
                  reads: b.readCount ?? 0,
                }))}
                xKey="name" yKey="reads" color="#1A1A2E"
              />
            </div>
          </div>

          {/* Conversion metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={card}>
              <div style={{ fontWeight: 700, color: '#1A1A2E', fontSize: 13, marginBottom: 16 }}>Subscription Health</div>
              {[
                { label: 'Trial Conversion',    value: 68, color: '#E8B84B' },
                { label: '90-day Retention',    value: 82, color: '#2ECC71' },
                { label: 'Active / Total Users', value: Math.round(((stats?.overview?.activeSubscriptions ?? 0) / (stats?.overview?.totalUsers ?? 1)) * 100), color: '#4A90E2' },
              ].map(m => (
                <div key={m.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B6B8A', marginBottom: 5 }}>
                    <span>{m.label}</span><span style={{ fontWeight: 600, color: '#1A1A2E' }}>{m.value}%</span>
                  </div>
                  <div style={{ height: 6, background: '#F0EFF5', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${m.value}%`, background: m.color, borderRadius: 3, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={card}>
              <div style={{ fontWeight: 700, color: '#1A1A2E', fontSize: 13, marginBottom: 16 }}>Platform Split</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <svg viewBox="0 0 80 80" width={90} height={90}>
                  <circle cx="40" cy="40" r="28" fill="none" stroke="#E8E6E1" strokeWidth="12"/>
                  <circle cx="40" cy="40" r="28" fill="none" stroke="#E8B84B" strokeWidth="12" strokeDasharray="106 70" strokeDashoffset="-19" strokeLinecap="round"/>
                  <circle cx="40" cy="40" r="28" fill="none" stroke="#1A1A2E" strokeWidth="12" strokeDasharray="61 115" strokeDashoffset="-125" strokeLinecap="round"/>
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[['iOS', '#E8B84B', '60%'], ['Android', '#1A1A2E', '35%'], ['Web', '#E8E6E1', '5%']].map(([lbl, bg, pct]) => (
                    <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6B6B8A' }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: bg, flexShrink: 0 }} />
                      <span>{lbl}</span>
                      <span style={{ fontWeight: 600, color: '#1A1A2E' }}>{pct}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
