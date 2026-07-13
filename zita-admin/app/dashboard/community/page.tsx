'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type FilterStatus = 'PENDING' | 'ACTIONED' | 'DISMISSED';

const reasonColors: Record<string, { bg: string; color: string }> = {
  SPAM:          { bg: '#FFEBEE', color: '#E74C3C' },
  HARASSMENT:    { bg: '#FFF3E0', color: '#F57C00' },
  SPOILER:       { bg: '#FFF9C4', color: '#F9A825' },
  INAPPROPRIATE: { bg: '#F3E5F5', color: '#8B5CF6' },
  OTHER:         { bg: '#F5F5F5', color: '#9E9E9E' },
};

export default function CommunityPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<FilterStatus>('PENDING');
  const [acting, setActing]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.community.reports(filter)
      .then(({ reports }: any) => setReports(reports))
      .finally(() => setLoading(false));
  }, [filter]);

  async function handleAction(id: string, action: 'ACTIONED' | 'DISMISSED') {
    setActing(id);
    await api.community.reviewReport(id, action);
    setReports(prev => prev.filter(r => r.id !== id));
    setActing(null);
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', fontFamily: 'Lora, serif' }}>Community Moderation</h2>
        <p style={{ fontSize: 12, color: '#6B6B8A', marginTop: 3 }}>Review flagged comments from readers.</p>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['PENDING', 'ACTIONED', 'DISMISSED'] as FilterStatus[]).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s', background: filter === s ? '#1A1A2E' : '#fff', color: filter === s ? '#fff' : '#6B6B8A', border: filter === s ? '1px solid #1A1A2E' : '1px solid #E8E6E1' }}>
            {s}
            {s === 'PENDING' && reports.length > 0 && filter === 'PENDING' && (
              <span style={{ marginLeft: 6, background: '#E74C3C', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10 }}>
                {reports.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading
          ? Array(3).fill(0).map((_, i) => (
              <div key={i} style={{ height: 140, background: '#E8E6E1', borderRadius: 14, animation: 'pulse 1.5s infinite' }} />
            ))
          : reports.length === 0
          ? (
            <div style={{ background: '#fff', border: '1px solid #E8E6E1', borderRadius: 14, padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 600, color: '#1A1A2E' }}>All clear</div>
              <div style={{ fontSize: 13, color: '#6B6B8A', marginTop: 4 }}>No {filter.toLowerCase()} reports.</div>
            </div>
          )
          : reports.map(report => (
              <div key={report.id} style={{ background: '#fff', border: '1px solid #E8E6E1', borderRadius: 14, padding: 18, boxShadow: '0 1px 3px rgba(26,26,46,0.06)' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, ...(reasonColors[report.reason] ?? { bg: '#F5F5F5', color: '#9E9E9E' }), background: (reasonColors[report.reason] ?? { bg: '#F5F5F5' }).bg }}>
                    {report.reason}
                  </span>
                  <span style={{ fontSize: 11, color: '#6B6B8A' }}>
                    in <strong style={{ color: '#1A1A2E' }}>{report.comment?.book?.title}</strong>
                  </span>
                  <span style={{ fontSize: 11, color: '#6B6B8A' }}>· {formatDate(report.createdAt)}</span>
                  <span style={{ fontSize: 11, color: '#6B6B8A', marginLeft: 'auto' }}>
                    by {report.comment?.user?.displayName}
                  </span>
                </div>

                {/* Comment body */}
                <div style={{ background: '#F7F6F3', borderRadius: 8, padding: 12, borderLeft: '2px solid #E8E6E1', marginBottom: 10 }}>
                  <p style={{ fontSize: 13, color: '#1A1A2E', lineHeight: 1.5, margin: 0, fontFamily: 'Lora, serif', fontStyle: 'italic' }}>
                    {report.comment?.body}
                  </p>
                </div>

                {report.details && (
                  <p style={{ fontSize: 11, color: '#6B6B8A', marginBottom: 10 }}>
                    Reporter note: <em>{report.details}</em>
                  </p>
                )}

                {filter === 'PENDING' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button disabled={acting === report.id} onClick={() => handleAction(report.id, 'ACTIONED')}
                      style={{ padding: '6px 14px', background: '#E74C3C', color: '#fff', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: acting === report.id ? 0.5 : 1 }}>
                      {acting === report.id ? '…' : '✗ Remove Comment'}
                    </button>
                    <button disabled={acting === report.id} onClick={() => handleAction(report.id, 'DISMISSED')}
                      style={{ padding: '6px 14px', background: '#F7F6F3', color: '#6B6B8A', fontSize: 11, fontWeight: 600, border: '1px solid #E8E6E1', borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: acting === report.id ? 0.5 : 1 }}>
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
