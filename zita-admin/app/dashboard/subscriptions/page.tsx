'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function SubscriptionsPage() {
  const [plans, setPlans]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.subscriptions.plans().then(setPlans).finally(() => setLoading(false));
  }, []);

  const statCard = (icon: string, value: string, label: string, delta: string, positive: boolean) => (
    <div style={{ background: '#fff', border: '1px solid #E8E6E1', borderRadius: 14, padding: 16, boxShadow: '0 1px 3px rgba(26,26,46,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: positive ? '#E8F5E9' : '#FFEBEE', color: positive ? '#2ECC71' : '#E74C3C' }}>{delta}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#6B6B8A', marginTop: 2 }}>{label}</div>
    </div>
  );

  const subRows = [
    { user: 'Amara O.', platform: '🍎 iOS',     plan: 'Monthly', status: 'ACTIVE',    statusColor: { bg: '#E8F5E9', color: '#2ECC71' }, expires: 'Jun 14, 2025' },
    { user: 'Kofi A.',  platform: '🤖 Android', plan: 'Monthly', status: 'TRIALING',  statusColor: { bg: '#E3F2FD', color: '#1976D2' }, expires: 'May 21, 2025' },
    { user: 'Fatima S.',platform: '🍎 iOS',     plan: 'Annual',  status: 'CANCELLED', statusColor: { bg: '#FFEBEE', color: '#E74C3C' }, expires: '—' },
    { user: 'Yuki T.',  platform: '🤖 Android', plan: 'Monthly', status: 'ACTIVE',    statusColor: { bg: '#E8F5E9', color: '#2ECC71' }, expires: 'May 30, 2025' },
    { user: 'Biola A.', platform: '🍎 iOS',     plan: 'Annual',  status: 'ACTIVE',    statusColor: { bg: '#E8F5E9', color: '#2ECC71' }, expires: 'Dec 1, 2025' },
  ];

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', fontFamily: 'Lora, serif' }}>Subscriptions</h2>
        <p style={{ fontSize: 12, color: '#6B6B8A', marginTop: 3 }}>Revenue and subscription health overview.</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {statCard('✅', '12,841', 'Active',    '+8%',  true)}
        {statCard('⏳', '3,420',  'Trialing',  '+24%', true)}
        {statCard('⚠️', '241',    'Past Due',  '+2%',  false)}
        {statCard('❌', '1,102',  'Cancelled', '-5%',  false)}
      </div>

      {/* Plans */}
      {!loading && plans.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 12 }}>Available Plans</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {plans.map((plan: any) => (
              <div key={plan.id} style={{ background: '#fff', border: '1px solid #E8E6E1', borderRadius: 14, padding: 16, boxShadow: '0 1px 3px rgba(26,26,46,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, color: '#1A1A2E', fontSize: 15 }}>{plan.name}</div>
                  {plan.savings && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#FDF3DC', color: '#E8B84B' }}>{plan.savings}</span>
                  )}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>
                  ${plan.price}<span style={{ fontSize: 14, fontWeight: 400, color: '#6B6B8A' }}>/{plan.period}</span>
                </div>
                {plan.trialDays && (
                  <div style={{ fontSize: 12, color: '#6B6B8A' }}>✓ {plan.trialDays}-day free trial</div>
                )}
                {plan.features && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {plan.features.slice(0, 3).map((f: string) => (
                      <div key={f} style={{ fontSize: 11, color: '#6B6B8A' }}>• {f}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent subscriptions table */}
      <div style={{ background: '#fff', border: '1px solid #E8E6E1', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(26,26,46,0.06)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #E8E6E1', fontWeight: 700, fontSize: 14, color: '#1A1A2E' }}>
          Recent Subscriptions
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(247,246,243,0.6)', borderBottom: '1px solid #E8E6E1' }}>
              {['User', 'Platform', 'Plan', 'Status', 'Expires'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 14px', fontSize: 10, fontWeight: 600, color: '#6B6B8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subRows.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(232,230,225,0.5)' }}>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#1A1A2E', fontWeight: 500 }}>{row.user}</td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#1A1A2E' }}>{row.platform}</td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#1A1A2E' }}>{row.plan}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, ...row.statusColor }}>
                    {row.status}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 11, color: '#6B6B8A', fontFamily: 'DM Mono, monospace' }}>{row.expires}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

