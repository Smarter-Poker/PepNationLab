'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Pagination from '@/components/Pagination';

const PAGE_SIZE = 25;

interface AgentRef {
  full_name: string | null;
  username: string | null;
}

interface Coupon {
  id: string;
  agent_id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order_amount: number | null;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  profiles: AgentRef | AgentRef[] | null;
}

interface AgentOption {
  id: string;
  full_name: string | null;
  username: string | null;
}

function resolveAgent(coupon: Coupon): AgentRef | null {
  const raw = coupon.profiles;
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [agentId, setAgentId] = useState('');
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  useEffect(() => {
    void Promise.all([loadCoupons(), loadAgents()]);
  }, []);

  async function loadCoupons() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/coupons');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Load Coupons');
      setCoupons(json.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed To Load Coupons');
    } finally {
      setLoading(false);
    }
  }

  async function loadAgents() {
    try {
      const res = await fetch('/api/admin/agents');
      const json = await res.json();
      if (!res.ok) return;
      const list: AgentOption[] = (json.data ?? []).map((row: any) => ({
        id: row.id,
        full_name: row.full_name,
        username: row.username,
      }));
      setAgents(list);
    } catch {
      // Non-fatal - agent picker just stays empty
    }
  }

  function openCreate() {
    setShowCreate(true);
    setFormError('');
    setAgentId(agents[0]?.id ?? '');
    setCode('');
    setDiscountType('percent');
    setDiscountValue('');
    setMinOrderAmount('');
    setMaxUses('');
    setExpiresAt('');
  }

  function closeCreate() {
    setShowCreate(false);
    setFormError('');
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!agentId) {
      setFormError('Choose An Agent To Assign This Coupon To.');
      return;
    }
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,24}$/.test(normalized)) {
      setFormError('Code Must Be 3 To 24 Characters: Letters, Numbers, And Hyphens Only.');
      return;
    }
    const value = Number(discountValue);
    if (isNaN(value) || value <= 0) {
      setFormError('Enter A Discount Value Greater Than Zero.');
      return;
    }
    if (discountType === 'percent' && value > 100) {
      setFormError('A Percent Discount Cannot Exceed 100.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          code: normalized,
          discountType,
          discountValue: value,
          minOrderAmount: minOrderAmount.trim() ? Number(minOrderAmount) : null,
          maxUses: maxUses.trim() ? Number(maxUses) : null,
          expiresAt: expiresAt || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Create Coupon');
      toast.success('Coupon Created');
      closeCreate();
      await loadCoupons();
    } catch (err: any) {
      setFormError(err.message || 'Failed To Create Coupon');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(coupon: Coupon) {
    const next = !coupon.is_active;
    setCoupons((prev) =>
      prev.map((c) => (c.id === coupon.id ? { ...c, is_active: next } : c))
    );
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: coupon.id, is_active: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Toggle Coupon');
      toast.success(next ? 'Coupon Activated' : 'Coupon Deactivated');
    } catch (err: any) {
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, is_active: coupon.is_active } : c))
      );
      toast.error(err.message || 'Failed To Toggle Coupon');
    }
  }

  async function handleDelete(coupon: Coupon) {
    if (!confirm(`Delete Coupon ${coupon.code}? This Cannot Be Undone.`)) return;
    const snapshot = coupons;
    setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
    try {
      const res = await fetch(`/api/admin/coupons?id=${encodeURIComponent(coupon.id)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Delete Coupon');
      toast.success('Coupon Deleted');
    } catch (err: any) {
      setCoupons(snapshot);
      toast.error(err.message || 'Failed To Delete Coupon');
    }
  }

  const totalPages = Math.max(1, Math.ceil(coupons.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = coupons.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-8)',
          gap: 'var(--space-4)',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 className="animated-gradient-text" style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>Coupons</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
            Manage Discount Codes Across All Agent Storefronts.
          </p>
        </div>
        <button
          type="button"
          className="btn-neon-cyan"
          onClick={openCreate}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create Coupon
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '2px solid var(--teal)',
              borderTopColor: 'transparent',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      ) : error ? (
        <div className="disclaimer-warning" style={{ padding: 'var(--space-6)' }}>
          <p style={{ color: 'var(--red)', fontSize: '0.9rem' }}>{error}</p>
        </div>
      ) : coupons.length === 0 ? (
        <div className="glass-panel hover-lift stagger-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="" style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.88rem' }}>
              No Coupons Found. Click Create Coupon To Add One.
            </p>
          </div>
        </div>
      ) : (
        <div className="glass-panel hover-lift stagger-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="" style={{ padding: 'var(--space-4)' }}>
            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Agent</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Min Order</th>
                  <th>Used / Max</th>
                  <th>Expires</th>
                  <th>Active</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((coupon) => {
                  const agent = resolveAgent(coupon);
                  const expired =
                    coupon.expires_at != null &&
                    new Date(coupon.expires_at).getTime() < Date.now();
                  return (
                    <tr key={coupon.id} className="table-row-hover">
                      <td
                        style={{
                          fontFamily: 'var(--font-brand)',
                          fontWeight: 700,
                          color: 'var(--teal)',
                        }}
                      >
                        {coupon.code}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{agent?.full_name || 'Unknown Agent'}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)' }}>
                          {agent?.username ? `@${agent.username}` : ''}
                        </div>
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>
                        {coupon.discount_type === 'percent' ? 'Percent' : 'Fixed'}
                      </td>
                      <td>
                        {coupon.discount_type === 'percent'
                          ? `${Number(coupon.discount_value)}%`
                          : `$${Number(coupon.discount_value).toFixed(2)}`}
                      </td>
                      <td>
                        {coupon.min_order_amount != null
                          ? `$${Number(coupon.min_order_amount).toFixed(2)}`
                          : 'None'}
                      </td>
                      <td>
                        {coupon.uses_count} / {coupon.max_uses != null ? coupon.max_uses : 'Unlimited'}
                      </td>
                      <td>
                        {coupon.expires_at
                          ? new Date(coupon.expires_at).toLocaleDateString()
                          : 'No Expiry'}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            coupon.is_active && !expired ? 'badge-teal' : 'badge-silver'
                          }`}
                          style={{ fontSize: '0.68rem' }}
                        >
                          {expired ? 'Expired' : coupon.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handleToggle(coupon)}
                          className="btn-silver"
                          style={{ marginRight: 6, padding: '6px 12px', fontSize: '0.75rem' }}
                        >
                          {coupon.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(coupon)}
                          style={{
                            fontSize: '0.75rem',
                            padding: 'var(--space-2) var(--space-3)',
                            background: 'rgba(229,62,62,0.1)',
                            border: '1px solid rgba(229,62,62,0.3)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--red)',
                            cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
            <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 'var(--space-4)',
          }}
        >
          <div className="glass-panel hover-lift stagger-fade-in" style={{ width: '100%', maxWidth: 560 }}>
            <div
              className=""
              style={{
                padding: 'var(--space-6)',
                maxHeight: '92vh',
                overflowY: 'auto',
              }}
            >
              <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>Create Coupon</h2>
              <p
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--grey-400)',
                  marginBottom: 'var(--space-5)',
                }}
              >
                Assign A Discount Code To Any Agent. The Code Will Apply To That Agent&apos;s Storefront.
              </p>

            {formError && (
              <div
                className="disclaimer-warning"
                style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}
              >
                <p style={{ color: 'var(--red)', fontSize: '0.82rem' }}>{formError}</p>
              </div>
            )}

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Agent</label>
                <select
                  className="form-input"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  required
                >
                  <option value="">Select An Agent</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name || a.username || 'Unnamed Agent'}
                      {a.username ? ` (@${a.username})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--space-4)',
                }}
              >
                <div className="form-group" style={{ marginTop: 0 }}>
                  <label className="form-label">Coupon Code</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="E.G. RESEARCH10"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginTop: 0 }}>
                  <label className="form-label">Discount Type</label>
                  <select
                    className="form-input"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
                  >
                    <option value="percent">Percent Off</option>
                    <option value="fixed">Fixed Amount Off</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 'var(--space-4)',
                }}
              >
                <div className="form-group" style={{ marginTop: 0 }}>
                  <label className="form-label">
                    {discountType === 'percent' ? 'Percent Off' : 'Amount Off ($)'}
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    step="0.01"
                    placeholder={discountType === 'percent' ? '10' : '15.00'}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginTop: 0 }}>
                  <label className="form-label">Minimum Order ($)</label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    step="0.01"
                    placeholder="Optional"
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginTop: 0 }}>
                  <label className="form-label">Max Uses</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    placeholder="Optional"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                <label className="form-label">Expires On</label>
                <input
                  type="date"
                  className="form-input"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 'var(--space-3)',
                }}
              >
                <button
                  type="button"
                  className="btn-silver"
                  onClick={closeCreate}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-neon-cyan" disabled={submitting}>
                  {submitting ? 'Creating Coupon...' : 'Create Coupon'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
