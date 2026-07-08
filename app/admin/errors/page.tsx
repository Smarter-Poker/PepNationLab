'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import Pagination from '@/components/Pagination';

const PAGE_SIZE = 25;

interface ClientErrorEvent {
  id: string;
  created_at: string;
  user_id: string | null;
  context: string | null;
  kind: string | null;
  message: string;
  stack: string | null;
  url: string | null;
  user_agent: string | null;
}

function kindBadge(kind: string | null): string {
  switch (kind) {
    case 'unhandledrejection': return 'badge-red';
    case 'error': return 'badge-red';
    case 'caught': return 'badge-silver';
    default: return 'badge-silver';
  }
}

export default function AdminErrorsPage() {
  const [rows, setRows] = useState<ClientErrorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contextFilter, setContextFilter] = useState<string>('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/client-errors', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed To Load Error Events');
      const json = await res.json();
      setRows(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed To Load Error Events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const contexts = useMemo(
    () => Array.from(new Set(rows.map(r => r.context).filter(Boolean))) as string[],
    [rows],
  );

  const filtered = useMemo(
    () => (contextFilter ? rows.filter(r => r.context === contextFilter) : rows),
    [rows, contextFilter],
  );

  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  useEffect(() => { setPage(1); }, [contextFilter]);

  return (
    <div style={{ padding: 'var(--space-6, 24px)', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ color: '#FFFFFF', fontSize: '1.5rem', fontWeight: 800 }}>Client Error Events</h1>
          <p style={{ color: '#A8B4C0', fontSize: '0.9rem', marginTop: 4 }}>
            Uncaught Errors And Unhandled Rejections Captured Across The App.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={contextFilter}
            onChange={(e) => setContextFilter(e.target.value)}
            style={{ background: '#162230', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', fontSize: '0.85rem' }}
          >
            <option value="">All Contexts</option>
            {contexts.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="button" onClick={load} className="btn-secondary" style={{ padding: '8px 16px' }}>Refresh</button>
        </div>
      </div>

      {error && (
        <div style={{ color: '#E53E3E', background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.3)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#A8B4C0', textAlign: 'center', padding: 40 }}>Loading Error Events...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#A8B4C0', textAlign: 'center', padding: 40 }}>No Error Events Recorded.</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#0F1923', color: '#A8B4C0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Time</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Context</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Kind</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Message</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>URL</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(r => (
                  <Fragment key={r.id}>
                    <tr
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                      style={{ borderTop: '1px solid rgba(255,255,255,0.06)', cursor: r.stack ? 'pointer' : 'default', color: '#D0DAE4' }}
                    >
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px' }}>{r.context || '-'}</td>
                      <td style={{ padding: '10px 12px' }}><span className={kindBadge(r.kind)}>{r.kind || 'error'}</span></td>
                      <td style={{ padding: '10px 12px', maxWidth: 420 }}>{r.message}</td>
                      <td style={{ padding: '10px 12px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#A8B4C0' }}>{r.url || '-'}</td>
                    </tr>
                    {expanded === r.id && r.stack && (
                      <tr key={`${r.id}-stack`} style={{ background: '#0B121A' }}>
                        <td colSpan={5} style={{ padding: '12px 16px' }}>
                          <pre style={{ color: '#A8B4C0', fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{r.stack}</pre>
                          {r.user_agent && <div style={{ color: '#6B7885', fontSize: '0.7rem', marginTop: 8 }}>User Agent: {r.user_agent}</div>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16 }}>
            <Pagination
              page={page}
              totalPages={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
