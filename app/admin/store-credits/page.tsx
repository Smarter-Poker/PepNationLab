'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface CreditRow {
  id: string;
  user_id: string;
  amount: number | string;
  balance_before: number | string;
  balance_after: number | string;
  type: 'issue' | 'redeem' | 'expire' | 'adjustment';
  source_refund_id: string | null;
  source_order_id: string | null;
  expires_at: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

interface UserMeta {
  full_name: string | null;
  email: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  issue: 'Issue',
  redeem: 'Redeem',
  expire: 'Expire',
  adjustment: 'Adjustment',
};

const TYPE_COLORS: Record<string, string> = {
  issue: '#68D391',
  redeem: 'var(--red)',
  expire: 'var(--grey-400)',
  adjustment: 'var(--silver)',
};

export default function AdminStoreCreditsPage() {
  const [rows, setRows] = useState<CreditRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserMeta>>({});
  const [loading, setLoading] = useState(true);
  const [filterUserId, setFilterUserId] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [grantUserId, setGrantUserId] = useState('');
  const [grantAmount, setGrantAmount] = useState('');
  const [grantDescription, setGrantDescription] = useState('');
  const [grantExpiresAt, setGrantExpiresAt] = useState('');
  const [grantSearch, setGrantSearch] = useState('');
  const [grantSearchResults, setGrantSearchResults] = useState<Array<{ id: string; full_name: string | null; email: string | null }>>([]);
  const [granting, setGranting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const url = filterUserId
        ? `/api/admin/store-credits?user_id=${encodeURIComponent(filterUserId)}`
        : '/api/admin/store-credits';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed To Load Store Credits');
      const json = await res.json();
      setRows(json.data ?? []);
      setUsers(json.users ?? {});
    } catch (e: any) {
      toast.error(e.message || 'Failed To Load Store Credits');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterUserId]);

  useEffect(() => {
    let cancelled = false;
    if (!grantSearch.trim()) {
      setGrantSearchResults([]);
      return () => { cancelled = true; };
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/researchers?query=${encodeURIComponent(grantSearch)}`, { cache: 'no-store' });
        const json = await res.json();
        if (!cancelled) setGrantSearchResults((json.data ?? []).slice(0, 8));
      } catch {
        if (!cancelled) setGrantSearchResults([]);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [grantSearch]);

  async function submitGrant() {
    const amount = Number(grantAmount);
    if (!grantUserId || !Number.isFinite(amount) || amount <= 0 || !grantDescription.trim()) {
      toast.error('User, Amount Greater Than Zero, And Description Are Required');
      return;
    }
    setGranting(true);
    try {
      const payload: Record<string, any> = {
        user_id: grantUserId,
        amount,
        description: grantDescription.trim(),
      };
      if (grantExpiresAt) {
        payload.expires_at = new Date(grantExpiresAt).toISOString();
      }
      const res = await fetch('/api/admin/store-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Grant Failed');
      toast.success(`Credit Granted. New Balance: $${Number(json.balance_after).toFixed(2)}`);
      setShowModal(false);
      setGrantUserId('');
      setGrantAmount('');
      setGrantDescription('');
      setGrantExpiresAt('');
      setGrantSearch('');
      setGrantSearchResults([]);
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Grant Failed');
    } finally {
      setGranting(false);
    }
  }

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>Store Credits</h1>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem' }}>
            Manage Researcher Store Credit Balances And Issue Manual Grants.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          Grant Credit
        </button>
      </div>

      <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <label className="form-label">Filter By User Id</label>
        <input
          type="text"
          className="form-input"
          placeholder="Paste Uuid To Filter"
          value={filterUserId}
          onChange={(e) => setFilterUserId(e.target.value.trim())}
        />
      </div>

      {loading ? (
        <div className="card-metal" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--grey-400)' }}>
          Loading Store Credits...
        </div>
      ) : rows.length === 0 ? (
        <div className="card-metal" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--grey-400)' }}>
          No Credit Activity Found.
        </div>
      ) : (
        <div className="card-metal" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--silver)' }}>Date</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--silver)' }}>User</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--silver)' }}>Type</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'right', color: 'var(--silver)' }}>Amount</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'right', color: 'var(--silver)' }}>Balance After</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--silver)' }}>Description</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--silver)' }}>Expires</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const u = users[r.user_id];
                  const userLabel = u?.full_name || (u?.email ? `@${u.email.split('@')[0]}` : r.user_id.slice(0, 8));
                  const amt = Number(r.amount);
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: 'var(--space-3)', color: 'var(--grey-400)' }}>
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: 'var(--space-3)', color: 'var(--silver)' }}>{userLabel}</td>
                      <td style={{ padding: 'var(--space-3)', color: TYPE_COLORS[r.type] ?? 'var(--grey-400)', fontWeight: 600 }}>
                        {TYPE_LABELS[r.type] ?? r.type}
                      </td>
                      <td style={{ padding: 'var(--space-3)', textAlign: 'right', color: amt >= 0 ? '#68D391' : 'var(--red)', fontWeight: 600 }}>
                        {amt >= 0 ? '+' : ''}${amt.toFixed(2)}
                      </td>
                      <td style={{ padding: 'var(--space-3)', textAlign: 'right', color: 'var(--teal)', fontWeight: 600 }}>
                        ${Number(r.balance_after).toFixed(2)}
                      </td>
                      <td style={{ padding: 'var(--space-3)', color: 'var(--grey-300)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.description || '—'}
                      </td>
                      <td style={{ padding: 'var(--space-3)', color: 'var(--grey-400)' }}>
                        {r.expires_at ? new Date(r.expires_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 'var(--space-4)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card-metal"
            style={{ padding: 'var(--space-6)', maxWidth: 480, width: '100%' }}
          >
            <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-4)' }}>Grant Store Credit</h2>

            <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
              <label className="form-label">Search User</label>
              <input
                type="text"
                className="form-input"
                placeholder="Name, Username, Phone"
                value={grantSearch}
                onChange={(e) => setGrantSearch(e.target.value)}
              />
              {grantSearchResults.length > 0 && (
                <div style={{ marginTop: 6, maxHeight: 200, overflowY: 'auto', background: 'var(--surface-1)', borderRadius: 'var(--radius-md)', border: 'var(--border-subtle)' }}>
                  {grantSearchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setGrantUserId(u.id);
                        setGrantSearch(u.full_name || u.email || u.id);
                        setGrantSearchResults([]);
                      }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: 'var(--space-2) var(--space-3)', background: 'transparent',
                        border: 'none', color: 'var(--silver)', cursor: 'pointer', fontSize: '0.85rem',
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{u.full_name || u.email || u.id.slice(0, 8)}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)' }}>{u.id}</div>
                    </button>
                  ))}
                </div>
              )}
              {grantUserId && (
                <div style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--teal)' }}>
                  Selected User Id: {grantUserId}
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
              <label className="form-label">Amount (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                placeholder="10.00"
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Goodwill Credit For Shipping Delay"
                value={grantDescription}
                onChange={(e) => setGrantDescription(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
              <label className="form-label">Expires At (Optional)</label>
              <input
                type="date"
                className="form-input"
                value={grantExpiresAt}
                onChange={(e) => setGrantExpiresAt(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={granting}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submitGrant} disabled={granting}>
                {granting ? 'Granting...' : 'Grant Credit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
