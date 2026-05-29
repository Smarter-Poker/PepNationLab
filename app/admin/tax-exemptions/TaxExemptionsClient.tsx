'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Exemption {
  id: string;
  user_id: string;
  state_code: string;
  organization_name: string;
  certificate_number: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approved_at: string | null;
  rejected_reason: string | null;
  expires_at: string | null;
  signed_url: string | null;
  profile?: { full_name: string | null; email: string | null; username: string | null } | null;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
  { value: 'all', label: 'All' },
] as const;

export default function TaxExemptionsClient() {
  const [status, setStatus] = useState<string>('pending');
  const [items, setItems] = useState<Exemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Exemption | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 25;

  async function load() {
    setLoading(true);
    try {
      const url = new URL('/api/admin/tax-exemptions', window.location.origin);
      url.searchParams.set('status', status);
      url.searchParams.set('page', String(page));
      url.searchParams.set('pageSize', String(pageSize));
      const res = await fetch(url.toString());
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Load Failed');
      setItems(json.data || []);
      setTotal(json.total || 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed To Load';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status, page]);

  async function act(action: 'approve' | 'reject' | 'expire') {
    if (!selected) return;
    if (action === 'reject' && !rejectReason.trim()) {
      toast.error('A Rejection Reason Is Required.');
      return;
    }
    setActing(true);
    try {
      const res = await fetch('/api/admin/tax-exemptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selected.id,
          action,
          rejected_reason: action === 'reject' ? rejectReason.trim() : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Action Failed');
      toast.success(
        action === 'approve' ? 'Certificate Approved.'
        : action === 'reject' ? 'Certificate Rejected.'
        : 'Certificate Marked Expired.'
      );
      setSelected(null);
      setRejectReason('');
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      toast.error(msg);
    } finally {
      setActing(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="card-metal" style={{ padding: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setStatus(opt.value); setPage(1); }}
              className={status === opt.value ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ fontSize: '0.8rem', padding: '6px 14px' }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--silver)' }}>{total} Total</div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--silver)', padding: 'var(--space-4)' }}>Loading Certificates.</p>
      ) : items.length === 0 ? (
        <p style={{ color: 'var(--silver)', padding: 'var(--space-4)' }}>No Certificates Match The Current Filter.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th style={{ textAlign: 'left', padding: 'var(--space-3)', color: 'var(--silver)' }}>Submitted</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-3)', color: 'var(--silver)' }}>Researcher</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-3)', color: 'var(--silver)' }}>State</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-3)', color: 'var(--silver)' }}>Organization</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-3)', color: 'var(--silver)' }}>Status</th>
                <th style={{ textAlign: 'right', padding: 'var(--space-3)', color: 'var(--silver)' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: 'var(--space-3)', color: 'var(--silver-light)' }}>
                    {new Date(it.uploaded_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: 'var(--space-3)', color: 'var(--white)' }}>
                    {it.profile?.full_name || it.profile?.username || it.profile?.email || it.user_id.slice(0,8)}
                  </td>
                  <td style={{ padding: 'var(--space-3)', color: 'var(--teal)', fontWeight: 600 }}>{it.state_code}</td>
                  <td style={{ padding: 'var(--space-3)', color: 'var(--silver-light)' }}>{it.organization_name}</td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{
                      fontSize: '0.74rem',
                      padding: '2px 10px',
                      borderRadius: 999,
                      background: it.status === 'approved' ? 'rgba(0,196,188,0.15)'
                        : it.status === 'pending' ? 'rgba(192,184,168,0.15)'
                        : it.status === 'rejected' ? 'rgba(229,62,62,0.15)'
                        : 'rgba(255,255,255,0.05)',
                      color: it.status === 'approved' ? 'var(--teal)'
                        : it.status === 'pending' ? 'var(--silver)'
                        : it.status === 'rejected' ? 'var(--red)'
                        : 'var(--grey-400)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>{it.status}</span>
                  </td>
                  <td style={{ padding: 'var(--space-3)', textAlign: 'right' }}>
                    <button type="button" className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 12px' }} onClick={() => { setSelected(it); setRejectReason(''); }}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
          <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
            Previous
          </button>
          <span style={{ color: 'var(--silver)', fontSize: '0.82rem', padding: '0 var(--space-3)', alignSelf: 'center' }}>
            Page {page} Of {totalPages}
          </span>
          <button type="button" className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </button>
        </div>
      )}

      {selected && (
        <div role="dialog" aria-modal="true" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)'
        }} onClick={() => setSelected(null)}>
          <div className="card-metal" onClick={(e) => e.stopPropagation()} style={{
            width: '100%', maxWidth: 760, padding: 'var(--space-6)', border: '1px solid var(--teal)', maxHeight: '92vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
              <div>
                <h2 style={{ color: 'var(--white)', fontSize: '1.2rem', marginBottom: 'var(--space-1)' }}>
                  Tax Exemption Certificate
                </h2>
                <p style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>
                  {selected.organization_name} — {selected.state_code}
                </p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)} style={{ fontSize: '0.78rem' }}>
                Close
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-5)', fontSize: '0.85rem' }}>
              <div>
                <div style={{ color: 'var(--grey-400)', fontSize: '0.74rem' }}>Researcher</div>
                <div style={{ color: 'var(--white)' }}>{selected.profile?.full_name || selected.profile?.username || selected.profile?.email || selected.user_id.slice(0,8)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--grey-400)', fontSize: '0.74rem' }}>Certificate Number</div>
                <div style={{ color: 'var(--white)' }}>{selected.certificate_number || 'Not Provided'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--grey-400)', fontSize: '0.74rem' }}>Submitted</div>
                <div style={{ color: 'var(--white)' }}>{new Date(selected.uploaded_at).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ color: 'var(--grey-400)', fontSize: '0.74rem' }}>Expires</div>
                <div style={{ color: 'var(--white)' }}>{selected.expires_at || 'No Expiration'}</div>
              </div>
            </div>

            {selected.signed_url ? (
              selected.mime_type === 'application/pdf' ? (
                <iframe src={selected.signed_url} title="Certificate" style={{ width: '100%', height: 480, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', background: '#fff' }} />
              ) : (
                <a href={selected.signed_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selected.signed_url} alt="Certificate" style={{ maxWidth: '100%', maxHeight: 480, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)' }} />
                </a>
              )
            ) : (
              <p style={{ color: 'var(--red)' }}>Signed URL Unavailable.</p>
            )}

            {selected.status === 'rejected' && selected.rejected_reason && (
              <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.3)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ color: 'var(--red)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Rejection Reason</div>
                <div style={{ color: 'var(--silver-light)', fontSize: '0.85rem' }}>{selected.rejected_reason}</div>
              </div>
            )}

            <div style={{ marginTop: 'var(--space-5)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 'var(--space-4)' }}>
              <label className="form-label">Rejection Reason (Required When Rejecting)</label>
              <textarea
                className="form-input"
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain Why This Certificate Cannot Be Approved."
              />
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => act('expire')} disabled={acting}>
                  Mark Expired
                </button>
                <button type="button" className="btn btn-danger" onClick={() => act('reject')} disabled={acting}>
                  Reject
                </button>
                <button type="button" className="btn btn-primary" onClick={() => act('approve')} disabled={acting}>
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
