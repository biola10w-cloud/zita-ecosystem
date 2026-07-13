'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const ROLES = ['READER', 'MODERATOR', 'ADMIN'];

const subColors: Record<string, { bg: string; color: string }> = {
  ACTIVE:    { bg: '#E8F5E9', color: '#2ECC71' },
  TRIALING:  { bg: '#E3F2FD', color: '#1976D2' },
  CANCELLED: { bg: '#FFEBEE', color: '#E74C3C' },
  EXPIRED:   { bg: '#F5F5F5', color: '#9E9E9E' },
  PAST_DUE:  { bg: '#FFF8E1', color: '#F39C12' },
};

export default function UsersPage() {
  const [users, setUsers]           = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);

  function load(q = search) {
    setLoading(true);
    api.users.list(1, 20, q || undefined)
      .then(({ users, pagination }: any) => { setUsers(users); setPagination(pagination); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function changeRole(id: string, role: string) {
    await api.users.updateRole(id, role);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
  }

  const tdStyle = { padding: '10px 14px', borderBottom: '1px solid rgba(232,230,225,0.6)', fontSize: 12, color: '#1A1A2E' };
  const thStyle = { textAlign: 'left' as const, padding: '8px 14px', fontSize: 10, fontWeight: 600, color: '#6B6B8A', textTransform: 'uppercase' as const, letterSpacing: '0.5px' };

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', fontFamily: 'Lora, serif' }}>Users</h2>
          <p style={{ fontSize: 12, color: '#6B6B8A', marginTop: 3 }}>{pagination?.total ?? 0} registered users</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(search)}
            placeholder="Search name or email…"
            style={{ padding: '7px 12px', border: '1px solid #E8E6E1', borderRadius: 10, fontSize: 12, fontFamily: 'DM Sans, sans-serif', width: 220, outline: 'none', background: '#fff', color: '#1A1A2E' }}
          />
          <button onClick={() => load(search)}
            style={{ background: '#1A1A2E', color: '#fff', fontWeight: 600, fontSize: 12, padding: '7px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            Search
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E8E6E1', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(26,26,46,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(247,246,243,0.6)', borderBottom: '1px solid #E8E6E1' }}>
              {['User', 'Role', 'Subscription', 'Joined', 'Change Role'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(6).fill(0).map((_, i) => (
                  <tr key={i}>
                    {Array(5).fill(0).map((_, j) => (
                      <td key={j} style={tdStyle}>
                        <div style={{ height: 14, background: '#E8E6E1', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                      </td>
                    ))}
                  </tr>
                ))
              : users.map(user => (
                  <tr key={user.id} style={{ transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F7F6F3')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(232,184,75,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E8B84B', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                          {user.displayName?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 12, color: '#1A1A2E' }}>{user.displayName}</div>
                          <div style={{ fontSize: 11, color: '#6B6B8A' }}>{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                        background: user.role === 'ADMIN' ? '#1A1A2E' : user.role === 'MODERATOR' ? '#F3E5F5' : '#F5F5F5',
                        color:      user.role === 'ADMIN' ? '#fff'    : user.role === 'MODERATOR' ? '#8B5CF6' : '#9E9E9E',
                      }}>{user.role}</span>
                    </td>
                    <td style={tdStyle}>
                      {user.subscription ? (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, ...(subColors[user.subscription.status] ?? { bg: '#F5F5F5', color: '#9E9E9E' }), background: (subColors[user.subscription.status] ?? { bg: '#F5F5F5' }).bg }}>
                          {user.subscription.status}
                        </span>
                      ) : <span style={{ color: '#6B6B8A', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ ...tdStyle, color: '#6B6B8A' }}>{formatDate(user.createdAt)}</td>
                    <td style={tdStyle}>
                      <select value={user.role} onChange={e => changeRole(user.id, e.target.value)}
                        style={{ fontSize: 11, border: '1px solid #E8E6E1', borderRadius: 7, padding: '3px 6px', background: '#F7F6F3', color: '#1A1A2E', outline: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                        {ROLES.map(r => <option key={r}>{r}</option>)}
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
