'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Endpoint {
  id: string;
  owner_type: 'admin' | 'agent';
  owner_id: string | null;
  name: string;
  url: string;
  event_types: string[];
  is_active: boolean;
  failure_count: number;
  last_failure_at: string | null;
  last_failure_reason: string | null;
  last_success_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Delivery {
  id: string;
  event_type: string;
  status: string;
  attempts: number;
  next_attempt_at: string | null;
  last_status_code: number | null;
  last_attempted_at: string | null;
  delivered_at: string | null;
  created_at: string;
  related_order_id: string | null;
}

const VALID_EVENTS = [
  'order.created',
  'order.approved',
  'order.shipped',
  'order.delivered',
  'order.cancelled',
  'order.refunded',
  'rma.created',
  'rma.resolved',
  'subscription.run',
  'price.changed',
] as const;

function formatDt(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function AdminWebhooksClient() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'admin' | 'agent'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(25);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveriesById, setDeliveriesById] = useState<Record<string, Delivery[]>>({});
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('owner_type', filter);
      params.set('page', String(page));
      params.set('page_size', String(pageSize));
      const res = await fetch(`/api/admin/webhooks?${params.toString()}`);
      const json = await res.json();
      if (res.ok) {
        setEndpoints(json.endpoints ?? []);
        setTotal(json.total ?? 0);
      } else {
        toast.error(json.error || 'Failed To Load Webhooks');
      }
    } catch {
      toast.error('Failed To Load Webhooks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter, page]);

  async function handleCreate() {
    if (!name.trim() || !url.trim() || eventTypes.length === 0) {
      toast.error('Please Fill In All Fields');
      return;
    }
    if (!url.startsWith('https://')) {
      toast.error('URL Must Start With https://');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, event_types: eventTypes }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed To Create Webhook');
        return;
      }
      setSecret(json.secret);
      setName('');
      setUrl('');
      setEventTypes([]);
      setShowCreate(false);
      await load();
      toast.success('Platform Webhook Created');
    } catch {
      toast.error('Failed To Create Webhook');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Disable This Webhook?')) return;
    try {
      const res = await fetch(`/api/admin/webhooks?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || 'Failed To Delete');
        return;
      }
      await load();
      toast.success('Webhook Disabled');
    } catch {
      toast.error('Failed To Delete');
    }
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!deliveriesById[id]) {
      try {
        const res = await fetch(`/api/admin/webhooks/${id}/deliveries`);
        if (res.ok) {
          const j = await res.json();
          setDeliveriesById((m) => ({ ...m, [id]: j.deliveries ?? [] }));
        } else {
          setDeliveriesById((m) => ({ ...m, [id]: [] }));
        }
      } catch {
        setDeliveriesById((m) => ({ ...m, [id]: [] }));
      }
    }
  }

  function copySecret() {
    if (!secret) return;
    navigator.clipboard.writeText(secret).then(
      () => toast.success('Secret Copied'),
      () => toast.error('Copy Failed')
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '1.6rem', margin: 0 }}>Webhooks</h1>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginTop: 4 }}>
            Manage Platform-Wide And Agent-Specific Webhook Endpoints
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          Create Platform Webhook
        </button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        {(['all', 'admin', 'agent'] as const).map((f) => (
          <button
            key={f}
            className={filter === f ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
            onClick={() => { setFilter(f); setPage(1); }}
          >
            {f === 'all' ? 'All' : f === 'admin' ? 'Platform' : 'Agent'}
          </button>
        ))}
      </div>

      {secret && (
        <div className="card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)', borderColor: 'var(--teal)' }}>
          <h4 style={{ color: 'var(--teal)', marginBottom: 'var(--space-3)' }}>Save This Secret Now — It Will Not Be Shown Again</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <code style={{ fontFamily: 'monospace', background: 'var(--black-2)', padding: 'var(--space-2) var(--space-3)', borderRadius: 4, color: 'var(--white)', fontSize: '0.85rem', overflowX: 'auto' }}>{secret}</code>
            <button className="btn btn-ghost btn-sm" onClick={copySecret}>Copy</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSecret(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="card-metal" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <h4 style={{ marginBottom: 'var(--space-4)' }}>Create Platform Webhook</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Platform Integration" className="input" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>HTTPS URL</label>
              <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhook" className="input" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 'var(--space-2)' }}>Event Types</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-2)' }}>
                {VALID_EVENTS.map((ev) => (
                  <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--silver)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={eventTypes.includes(ev)} onChange={(e) => {
                      if (e.target.checked) setEventTypes([...eventTypes, ev]);
                      else setEventTypes(eventTypes.filter((x) => x !== ev));
                    }} />
                    <code style={{ fontFamily: 'monospace' }}>{ev}</code>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn btn-primary" onClick={handleCreate} disabled={busy}>Create Webhook</button>
              <button className="btn btn-ghost" onClick={() => { setShowCreate(false); setName(''); setUrl(''); setEventTypes([]); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--grey-400)' }}>Loading...</p>
      ) : endpoints.length === 0 ? (
        <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <p style={{ color: 'var(--grey-400)' }}>No Webhooks To Show</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {endpoints.map((ep) => (
              <div key={ep.id} className="card" style={{ padding: 'var(--space-5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 4, flexWrap: 'wrap' }}>
                      <strong style={{ color: 'var(--white)' }}>{ep.name}</strong>
                      <span style={{
                        fontSize: '0.72rem', padding: '2px 8px', borderRadius: 4,
                        background: ep.is_active ? 'rgba(0,196,188,0.15)' : 'rgba(229,62,62,0.15)',
                        color: ep.is_active ? 'var(--teal)' : 'var(--danger)',
                      }}>{ep.is_active ? 'Active' : 'Disabled'}</span>
                      <span style={{
                        fontSize: '0.72rem', padding: '2px 8px', borderRadius: 4,
                        background: ep.owner_type === 'admin' ? 'rgba(0,196,188,0.1)' : 'rgba(168,180,192,0.1)',
                        color: ep.owner_type === 'admin' ? 'var(--teal)' : 'var(--silver)',
                      }}>{ep.owner_type === 'admin' ? 'Platform' : 'Agent'}</span>
                    </div>
                    <code style={{ fontSize: '0.78rem', color: 'var(--grey-400)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{ep.url}</code>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 'var(--space-2)' }}>
                      {ep.event_types.map((ev) => (
                        <span key={ev} style={{ fontSize: '0.7rem', background: 'var(--black-2)', padding: '2px 6px', borderRadius: 3, color: 'var(--silver)', fontFamily: 'monospace' }}>{ev}</span>
                      ))}
                    </div>
                    <div style={{ marginTop: 'var(--space-2)', fontSize: '0.75rem', color: 'var(--grey-400)' }}>
                      Owner: {ep.owner_id ? ep.owner_id.slice(0, 8) : 'Platform'} | Last Success: {formatDt(ep.last_success_at)} | Failures: {ep.failure_count}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleExpand(ep.id)}>
                      {expandedId === ep.id ? 'Hide History' : 'View History'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(ep.id)} style={{ color: 'var(--danger)' }}>Disable</button>
                  </div>
                </div>

                {expandedId === ep.id && (
                  <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 'var(--space-4)' }}>
                    <h5 style={{ fontSize: '0.85rem', color: 'var(--teal)', marginBottom: 'var(--space-3)' }}>Recent Deliveries</h5>
                    {!deliveriesById[ep.id] ? (
                      <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem' }}>Loading...</p>
                    ) : deliveriesById[ep.id].length === 0 ? (
                      <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem' }}>No Deliveries Yet</p>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ color: 'var(--grey-400)', textAlign: 'left' }}>
                              <th style={{ padding: 'var(--space-2)' }}>Event</th>
                              <th style={{ padding: 'var(--space-2)' }}>Status</th>
                              <th style={{ padding: 'var(--space-2)' }}>Attempts</th>
                              <th style={{ padding: 'var(--space-2)' }}>HTTP</th>
                              <th style={{ padding: 'var(--space-2)' }}>Last Attempt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {deliveriesById[ep.id].slice(0, 100).map((d) => (
                              <tr key={d.id} style={{ color: 'var(--silver)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: 'var(--space-2)', fontFamily: 'monospace' }}>{d.event_type}</td>
                                <td style={{ padding: 'var(--space-2)' }}>{d.status}</td>
                                <td style={{ padding: 'var(--space-2)' }}>{d.attempts}</td>
                                <td style={{ padding: 'var(--space-2)' }}>{d.last_status_code ?? '—'}</td>
                                <td style={{ padding: 'var(--space-2)' }}>{formatDt(d.last_attempted_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span style={{ color: 'var(--grey-400)', fontSize: '0.85rem' }}>Page {page} Of {totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
