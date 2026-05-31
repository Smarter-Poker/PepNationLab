'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Coupon {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order_amount: number | null;
  max_uses: number | null;
  max_uses_per_user: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AgentCoupons({ agentId }: { agentId: string }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create form
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [maxUsesPerUser, setMaxUsesPerUser] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from('coupons')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (loadError) {
      setError(loadError.message);
    } else {
      setCoupons((data as Coupon[]) ?? []);
    }
    setLoading(false);
  }, [agentId]);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    const normalizedCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,24}$/.test(normalizedCode)) {
      setFormError('Code Must Be 3 To 24 Characters: Letters, Numbers, And Hyphens Only.');
      return;
    }
    const value = Number(discountValue);
    if (isNaN(value) || value <= 0) {
      setFormError('Enter A Discount Value Greater Than Zero.');
      return;
    }
    if (discountType === 'percent' && value > 100) {
      setFormError('A Percentage Discount Cannot Exceed 100.');
      return;
    }

    setCreating(true);
    const supabase = createClient();
    const { error: insertError } = await supabase.from('coupons').insert({
      agent_id: agentId,
      code: normalizedCode,
      discount_type: discountType,
      discount_value: value,
      min_order_amount: minOrder.trim() ? Number(minOrder) : null,
      max_uses: maxUses.trim() ? Number(maxUses) : null,
      max_uses_per_user: maxUsesPerUser.trim() ? Number(maxUsesPerUser) : null,
      expires_at: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
      is_active: true,
    });
    setCreating(false);

    if (insertError) {
      setFormError(
        insertError.message.includes('duplicate')
          ? 'You Already Have A Coupon With That Code.'
          : insertError.message
      );
      return;
    }

    setCode('');
    setDiscountValue('');
    setMinOrder('');
    setMaxUses('');
    setMaxUsesPerUser('');
    setExpiresAt('');
    await loadCoupons();
  }

  async function toggleActive(coupon: Coupon) {
    const supabase = createClient();
    setCoupons((prev) =>
      prev.map((c) => (c.id === coupon.id ? { ...c, is_active: !c.is_active } : c))
    );
    const { error: updateError } = await supabase
      .from('coupons')
      .update({ is_active: !coupon.is_active })
      .eq('id', coupon.id);
    if (updateError) {
      // Roll back on failure
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, is_active: coupon.is_active } : c))
      );
      alert(updateError.message);
    }
  }

  async function deleteCoupon(couponId: string) {
    if (!confirm('Are you sure you want to permanently delete this coupon?')) return;
    const supabase = createClient();
    setCoupons(prev => prev.filter(c => c.id !== couponId));
    const { error: delError } = await supabase.from('coupons').delete().eq('id', couponId);
    if (delError) {
      alert('Failed to delete coupon: ' + delError.message);
      await loadCoupons();
    }
  }

  return (
    <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
      <h3
        style={{
          fontSize: '1.1rem',
          color: 'var(--white)',
          marginBottom: 'var(--space-2)',
          fontFamily: 'var(--font-brand)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        Discount Coupons
      </h3>
      <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginBottom: 'var(--space-6)' }}>
        Create Discount Codes Your Referred Researchers Can Redeem At Checkout.
      </p>

      <form
        onSubmit={handleCreate}
        className="card-metal"
        style={{
          padding: 'var(--space-5)',
          marginBottom: 'var(--space-6)',
        }}
      >
        {formError && (
          <div className="disclaimer-warning" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)' }}>
            <p style={{ color: 'var(--red)', fontSize: '0.8rem', margin: 0 }}>{formError}</p>
          </div>
        )}

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Coupon Code</label>
            <input
              type="text"
              className="form-input"
              placeholder="E.g. RESEARCH10"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Discount Type</label>
            <select
              className="form-input"
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
            >
              <option value="percent">Percentage Off</option>
              <option value="fixed">Fixed Amount Off</option>
            </select>
          </div>
        </div>

        <div className="grid-3">
          <div className="form-group">
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
          <div className="form-group">
            <label className="form-label">Minimum Order ($)</label>
            <input
              type="number"
              className="form-input"
              min="0"
              step="0.01"
              placeholder="Optional"
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
            />
          </div>
          <div className="form-group">
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
          <div className="form-group">
            <label className="form-label">Max Uses Per User</label>
            <input
              type="number"
              className="form-input"
              min="1"
              placeholder="Optional"
              value={maxUsesPerUser}
              onChange={(e) => setMaxUsesPerUser(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Expires On</label>
          <input
            type="date"
            className="form-input"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={creating}>
          {creating ? 'Creating Coupon...' : 'Create Coupon'}
        </button>
      </form>

      {/* Coupon list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : error ? (
        <div className="disclaimer-warning" style={{ padding: 'var(--space-4)' }}>
          <p style={{ color: 'var(--red)', fontSize: '0.85rem', margin: 0 }}>{error}</p>
        </div>
      ) : coupons.length === 0 ? (
        <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', textAlign: 'center', padding: 'var(--space-6) 0' }}>
          No Coupons Created Yet
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {coupons.map((c) => {
            const expired = c.expires_at != null && new Date(c.expires_at).getTime() < Date.now();
            return (
              <div
                key={c.id}
                className="card-metal"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  opacity: c.is_active && !expired ? 1 : 0.6,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontFamily: 'var(--font-brand)', fontWeight: 700, color: 'var(--teal)' }}>
                      {c.code}
                    </span>
                    <span
                      className={`badge ${c.is_active && !expired ? 'badge-teal' : 'badge-silver'}`}
                      style={{ fontSize: '0.62rem' }}
                    >
                      {expired ? 'Expired' : c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--grey-400)', marginTop: 4 }}>
                    {c.discount_type === 'percent'
                      ? `${Number(c.discount_value)}% Off`
                      : `$${Number(c.discount_value).toFixed(2)} Off`}
                    {c.min_order_amount != null
                      ? ` / Min Order $${Number(c.min_order_amount).toFixed(2)}`
                      : ''}
                    {' / Used '}
                    {c.uses_count}
                    {c.max_uses != null ? ` Of ${c.max_uses}` : ' Times'}
                    {c.expires_at
                      ? ` / Expires ${new Date(c.expires_at).toLocaleDateString()}`
                      : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    onClick={() => toggleActive(c)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.76rem', padding: 'var(--space-2) var(--space-4)' }}
                  >
                    {c.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCoupon(c.id)}
                    style={{
                      fontSize: '0.76rem', padding: 'var(--space-2) var(--space-3)',
                      background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.3)',
                      borderRadius: 'var(--radius-md)', color: 'var(--red)', cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
