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

interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
  preferredLanguage: string;
  isEmailVerified: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({ email: '', password: '', displayName: '', role: 'READER', preferredLanguage: 'en' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function loadUsers(page = 1, q = search, role = roleFilter) {
    setLoading(true);
    setError('');
    api.users.list(page, 20, q || undefined, role || undefined)
      .then(({ users, pagination }: any) => { 
        setUsers(users); 
        setPagination(pagination);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  function loadStats() {
    api.users.stats()
      .then(setStats)
      .catch(err => console.error('Failed to load stats:', err));
  }

  useEffect(() => { 
    loadUsers();
    loadStats();
  }, []);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      const newUser = await api.users.create(formData);
      setUsers([newUser, ...users]);
      setShowCreateModal(false);
      setFormData({ email: '', password: '', displayName: '', role: 'READER', preferredLanguage: 'en' });
      setSuccess('User created successfully');
      loadStats();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    
    setError('');
    setSuccess('');
    
    try {
      const updated = await api.users.update(selectedUser.id, {
        displayName: formData.displayName,
        preferredLanguage: formData.preferredLanguage,
      });
      setUsers(users.map(u => u.id === selectedUser.id ? updated : u));
      setShowEditModal(false);
      setSelectedUser(null);
      setSuccess('User updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function changeRole(id: string, role: string) {
    try {
      const updated = await api.users.updateRole(id, role);
      setUsers(users.map(u => u.id === id ? updated : u));
    } catch (err: any) {
      alert('Failed to update role: ' + err.message);
    }
  }

  async function deleteUser(id: string) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    try {
      await api.users.delete(id);
      setUsers(users.filter(u => u.id !== id));
      loadStats();
      setSuccess('User deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      alert('Failed to delete user: ' + err.message);
    }
  }

  const tdStyle = { padding: '10px 14px', borderBottom: '1px solid rgba(232,230,225,0.6)', fontSize: 12, color: '#1A1A2E' };
  const thStyle = { textAlign: 'left' as const, padding: '8px 14px', fontSize: 10, fontWeight: 600, color: '#6B6B8A', textTransform: 'uppercase' as const, letterSpacing: '0.5px' };

  return (
    <div style={{ maxWidth: 1200 }}>
      {error && (
        <div style={{ marginBottom: 16, padding: 12, background: '#FFEBEE', border: '1px solid #EF5350', borderRadius: 10, color: '#C62828', fontSize: 12 }}>
          {error}
        </div>
      )}
      
      {success && (
        <div style={{ marginBottom: 16, padding: 12, background: '#E8F5E9', border: '1px solid #4CAF50', borderRadius: 10, color: '#2E7D32', fontSize: 12 }}>
          {success}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', fontFamily: 'Lora, serif' }}>Users</h2>
          <p style={{ fontSize: 12, color: '#6B6B8A', marginTop: 3 }}>{pagination?.total ?? 0} registered users</p>
          {stats && (
            <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
              <div><span style={{ fontSize: 11, color: '#6B6B8A' }}>Admins:</span> <strong style={{ fontSize: 12 }}>{stats.byRole.admin}</strong></div>
              <div><span style={{ fontSize: 11, color: '#6B6B8A' }}>Moderators:</span> <strong style={{ fontSize: 12 }}>{stats.byRole.moderator}</strong></div>
              <div><span style={{ fontSize: 11, color: '#6B6B8A' }}>Readers:</span> <strong style={{ fontSize: 12 }}>{stats.byRole.reader}</strong></div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadUsers(1, search, roleFilter)}
            placeholder="Search name or email…"
            style={{ padding: '7px 12px', border: '1px solid #E8E6E1', borderRadius: 10, fontSize: 12, fontFamily: 'DM Sans, sans-serif', width: 200, outline: 'none', background: '#fff', color: '#1A1A2E' }}
          />
          <select
            value={roleFilter}
            onChange={e => { setRoleFilter(e.target.value); loadUsers(1, search, e.target.value); }}
            style={{ padding: '7px 12px', border: '1px solid #E8E6E1', borderRadius: 10, fontSize: 12, fontFamily: 'DM Sans, sans-serif', outline: 'none', background: '#fff', color: '#1A1A2E' }}
          >
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={() => { setShowCreateModal(true); setFormData({ email: '', password: '', displayName: '', role: 'READER', preferredLanguage: 'en' }); }}
            style={{ background: '#1A1A2E', color: '#fff', fontWeight: 600, fontSize: 12, padding: '7px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            + Add User
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E8E6E1', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(26,26,46,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(247,246,243,0.6)', borderBottom: '1px solid #E8E6E1' }}>
              {['User', 'Role', 'Verified', 'Joined', 'Actions'].map(h => (
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
                      <select value={user.role} onChange={e => changeRole(user.id, e.target.value)}
                        style={{ fontSize: 11, border: '1px solid #E8E6E1', borderRadius: 7, padding: '3px 6px', background: '#F7F6F3', color: '#1A1A2E', outline: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                        {ROLES.map(r => <option key={r}>{r}</option>)}
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: user.isEmailVerified ? '#E8F5E9' : '#FFF8E1', color: user.isEmailVerified ? '#2ECC71' : '#F39C12' }}>
                        {user.isEmailVerified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: '#6B6B8A' }}>{formatDate(user.createdAt)}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => { setSelectedUser(user); setFormData({ ...formData, displayName: user.displayName, preferredLanguage: user.preferredLanguage }); setShowEditModal(true); }}
                          style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #E8E6E1', borderRadius: 6, background: '#F7F6F3', color: '#1A1A2E', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                          Edit
                        </button>
                        <button onClick={() => deleteUser(user.id)}
                          style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #EF5350', borderRadius: 6, background: '#FFEBEE', color: '#C62828', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {pagination && pagination.pages > 1 && (
        <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'center' }}>
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(page => (
            <button key={page} onClick={() => loadUsers(page, search, roleFilter)}
              style={{ padding: '6px 10px', fontSize: 12, border: page === pagination.page ? '1px solid #1A1A2E' : '1px solid #E8E6E1', borderRadius: 6, background: page === pagination.page ? '#1A1A2E' : '#F7F6F3', color: page === pagination.page ? '#fff' : '#1A1A2E', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              {page}
            </button>
          ))}
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, maxWidth: 400, width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#1A1A2E' }}>Create New User</h3>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="email" placeholder="Email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required style={{ padding: 10, border: '1px solid #E8E6E1', borderRadius: 8, fontSize: 12, fontFamily: 'DM Sans, sans-serif', outline: 'none' }} />
              <input type="text" placeholder="Display Name" value={formData.displayName} onChange={e => setFormData({ ...formData, displayName: e.target.value })} required style={{ padding: 10, border: '1px solid #E8E6E1', borderRadius: 8, fontSize: 12, fontFamily: 'DM Sans, sans-serif', outline: 'none' }} />
              <input type="password" placeholder="Password (min 8 chars)" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required minLength={8} style={{ padding: 10, border: '1px solid #E8E6E1', borderRadius: 8, fontSize: 12, fontFamily: 'DM Sans, sans-serif', outline: 'none' }} />
              <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} style={{ padding: 10, border: '1px solid #E8E6E1', borderRadius: 8, fontSize: 12, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
              <select value={formData.preferredLanguage} onChange={e => setFormData({ ...formData, preferredLanguage: e.target.value })} style={{ padding: 10, border: '1px solid #E8E6E1', borderRadius: 8, fontSize: 12, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="submit" style={{ flex: 1, padding: 10, background: '#1A1A2E', color: '#fff', fontWeight: 600, fontSize: 12, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Create</button>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ flex: 1, padding: 10, background: '#F7F6F3', color: '#1A1A2E', fontWeight: 600, fontSize: 12, borderRadius: 8, border: '1px solid #E8E6E1', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, maxWidth: 400, width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#1A1A2E' }}>Edit User</h3>
            <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 10, background: '#F7F6F3', borderRadius: 8, fontSize: 12, color: '#6B6B8A' }}>{selectedUser.email}</div>
              <input type="text" placeholder="Display Name" value={formData.displayName} onChange={e => setFormData({ ...formData, displayName: e.target.value })} required style={{ padding: 10, border: '1px solid #E8E6E1', borderRadius: 8, fontSize: 12, fontFamily: 'DM Sans, sans-serif', outline: 'none' }} />
              <select value={formData.preferredLanguage} onChange={e => setFormData({ ...formData, preferredLanguage: e.target.value })} style={{ padding: 10, border: '1px solid #E8E6E1', borderRadius: 8, fontSize: 12, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="submit" style={{ flex: 1, padding: 10, background: '#1A1A2E', color: '#fff', fontWeight: 600, fontSize: 12, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Save</button>
                <button type="button" onClick={() => setShowEditModal(false)} style={{ flex: 1, padding: 10, background: '#F7F6F3', color: '#1A1A2E', fontWeight: 600, fontSize: 12, borderRadius: 8, border: '1px solid #E8E6E1', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

