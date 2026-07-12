'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { reportClientError } from '@/lib/report-client-error';
import { exportCSV, downloadCSV } from '@/lib/export';
import { fetchJson } from '@/lib/fetch-json';

// Types
interface Coupon {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_subtotal: number | null;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  starts_at?: string | null;
  archived_at?: string | null;
}

interface CouponPerformance {
  uses: number;
  total_discount: number;
  revenue: number;
  unique_buyers: number;
}

interface BulkGenerateOptions {
  prefix: string;
  count: number;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_subtotal: string;
  max_uses: string;
  expires_at: string;
  starts_at: string;
}

function ModalShell({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 'var(--space-4)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="glass-panel"
        style={{
          maxWidth: wide ? 750 : 520,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 'var(--space-7)',
          borderRadius: '16px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-5)',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '1.3rem',
              fontFamily: 'var(--font-brand)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--white)',
              fontWeight: 800,
            }}
          >
            {title}
          </h3>
          <button onClick={onClose} className="btn-silver">
            Close
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function QrModal({ coupon, storefront }: { coupon: Coupon; storefront: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const qrUrl = coupon.code ? `${storefront}?coupon=${coupon.code}` : storefront;
    // qrcode loads only when the QR modal actually opens.
    import('qrcode')
      .then((QRCode) => {
        if (!canvasRef.current) return;
        return QRCode.toCanvas(canvasRef.current, qrUrl, {
          width: 200,
          color: { dark: '#00C4BC', light: '#0a0f14' },
        });
      })
      .catch((err) => reportClientError('agent.coupons.qr', err));
  }, [storefront, coupon.code]);

  return (
    <div style={{ textAlign: 'center' }}>
      <canvas ref={canvasRef} role="img" aria-label={`QR Code Linking To ${coupon.code ? `${storefront}?coupon=${coupon.code}` : storefront}`} style={{ borderRadius: '8px', marginBottom: 'var(--space-4)' }} />
      <p style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>
        QR Code Links To Storefront With Coupon: <strong style={{ color: 'var(--teal)' }}>{coupon.code}</strong>
      </p>
      <p style={{ color: 'var(--grey-400)', fontSize: '0.78rem' }}>{storefront}?coupon={coupon.code}</p>
    </div>
  );
}

function RedemptionsModal({
  coupon,
  agentSlug,
}: {
  coupon: Coupon;
  agentSlug: string;
}) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJson<{ data: any[] }>(`/api/agent/coupons/${coupon.id}/redemptions`)
      .then((res) => {
        if (res.ok) setData(res.data?.data || []);
        setLoading(false);
      });
  }, [coupon.id]);

  return loading ? (
    <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>Loading Redemptions...</div>
  ) : data.length === 0 ? (
    <p style={{ color: 'var(--grey-400)', textAlign: 'center' }}>No Redemptions Recorded Yet.</p>
  ) : (
    <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
      <thead>
        <tr>
          <th>Order ID</th>
          <th>Buyer</th>
          <th>Discount</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {data.map((r: any) => (
          <tr key={r.order_id}>
            <td style={{ fontFamily: 'monospace' }}>{r.order_id?.slice(0, 8)}…</td>
            <td>{r.buyer_name || r.buyer_email || 'Unknown'}</td>
            <td>${Number(r.discount_amount || 0).toFixed(2)}</td>
            <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BulkGenerateModal({
  onGenerate,
  onClose,
}: {
  onGenerate: (opts: BulkGenerateOptions) => void;
  onClose: () => void;
}) {
  const [opts, setOpts] = useState<BulkGenerateOptions>({
    prefix: 'PROMO',
    count: 10,
    discount_type: 'percent',
    discount_value: 10,
    min_subtotal: '',
    max_uses: '1',
    expires_at: '',
    starts_at: '',
  });

  const set = (k: keyof BulkGenerateOptions, v: string | number) =>
    setOpts((prev) => ({ ...prev, [k]: v }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--grey-300)', display: 'block', marginBottom: 4 }}>Prefix</label>
          <input
            className="form-input"
            value={opts.prefix}
            onChange={(e) => set('prefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--grey-300)', display: 'block', marginBottom: 4 }}>Count (1–100)</label>
          <input
            className="form-input"
            type="number"
            value={opts.count}
            min={1}
            max={100}
            onChange={(e) => set('count', Math.min(100, Math.max(1, Number(e.target.value))))}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--grey-300)', display: 'block', marginBottom: 4 }}>Discount Type</label>
          <select
            className="form-input"
            value={opts.discount_type}
            onChange={(e) => set('discount_type', e.target.value)}
          >
            <option value="percent">Percent Off</option>
            <option value="fixed">Fixed Dollar Off</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--grey-300)', display: 'block', marginBottom: 4 }}>
            {opts.discount_type === 'percent' ? 'Percent Off' : 'Dollar Off'}
          </label>
          <input
            className="form-input"
            type="number"
            value={opts.discount_value}
            min={0.01}
            step={opts.discount_type === 'percent' ? 1 : 0.01}
            onChange={(e) => set('discount_value', Number(e.target.value))}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--grey-300)', display: 'block', marginBottom: 4 }}>Min Subtotal ($)</label>
          <input
            className="form-input"
            type="number"
            placeholder="None"
            value={opts.min_subtotal}
            step={0.01}
            onChange={(e) => set('min_subtotal', e.target.value)}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--grey-300)', display: 'block', marginBottom: 4 }}>Max Uses Each</label>
          <input
            className="form-input"
            type="number"
            placeholder="Unlimited"
            value={opts.max_uses}
            min={1}
            onChange={(e) => set('max_uses', e.target.value)}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--grey-300)', display: 'block', marginBottom: 4 }}>Starts At (Optional)</label>
          <input
            className="form-input"
            type="datetime-local"
            value={opts.starts_at}
            onChange={(e) => set('starts_at', e.target.value)}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--grey-300)', display: 'block', marginBottom: 4 }}>Expires At (Optional)</label>
          <input
            className="form-input"
            type="datetime-local"
            value={opts.expires_at}
            onChange={(e) => set('expires_at', e.target.value)}
          />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
        <button className="btn-silver" onClick={onClose}>Cancel</button>
        <button className="btn-neon-cyan" onClick={() => onGenerate(opts)}>
          Generate {opts.count} Codes
        </button>
      </div>
    </div>
  );
}


export default function AgentCoupons({ agentSlug: propSlug }: { agentSlug?: string }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The resolved slug (from prop or /api/agent/me)
  const [resolvedSlug, setResolvedSlug] = useState<string>(propSlug || '');

  // Performance data keyed by coupon.code
  const [perf, setPerf] = useState<Record<string, CouponPerformance>>({});

  // QR modal
  const [qrCoupon, setQrCoupon] = useState<Coupon | null>(null);

  // Redemptions modal
  const [redemptionsCoupon, setRedemptionsCoupon] = useState<Coupon | null>(null);

  // Bulk generate modal
  const [showBulkModal, setShowBulkModal] = useState(false);

  // In-UI archive confirmation (replaces window.confirm)
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);

  // Create / Edit form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [minSubtotal, setMinSubtotal] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [saving, setSaving] = useState(false);

  // Track which fields have been touched (for inline validation)
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));

  const validation = useMemo(() => {
    const errs: Record<string, string> = {};
    if (!code.trim()) errs.code = 'Code Is Required.';
    else if (!/^[A-Z0-9_-]{3,24}$/.test(code.trim().toUpperCase()))
      errs.code = 'Code Must Be 3–24 Characters, Letters, Numbers, Dash, Or Underscore.';
    if (!discountValue || isNaN(Number(discountValue)) || Number(discountValue) <= 0)
      errs.discountValue = 'Discount Value Must Be Greater Than Zero.';
    if (discountType === 'percent' && Number(discountValue) > 100)
      errs.discountValue = 'Percent Discount Cannot Exceed 100%.';
    if (minSubtotal && (isNaN(Number(minSubtotal)) || Number(minSubtotal) < 0))
      errs.minSubtotal = 'Min Subtotal Must Be A Positive Number.';
    if (maxUses && (isNaN(Number(maxUses)) || Number(maxUses) < 1))
      errs.maxUses = 'Max Uses Must Be At Least 1.';
    return errs;
  }, [code, discountType, discountValue, minSubtotal, maxUses]);

  // Storefront URL for this agent
  const storefrontUrl = resolvedSlug
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://pepnationlab.com'}/${resolvedSlug}`
    : '';

  const fetchCoupons = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchJson<{ data: Coupon[] }>('/api/agent/coupons');
      if (!res.ok) throw new Error(res.error || 'Failed To Fetch Coupons');
      setCoupons(res.data?.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPerformance = useCallback(async () => {
    try {
      const res = await fetchJson<{ data: Record<string, CouponPerformance> }>('/api/agent/coupons/performance');
      if (!res.ok) return;
      setPerf(res.data?.data || {});
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!propSlug) {
      fetchJson<{ slug?: string }>('/api/agent/me')
        .then((res) => { if (res.ok && res.data?.slug) setResolvedSlug(res.data.slug); });
    }
    fetchCoupons();
    fetchPerformance();
  }, [fetchCoupons, fetchPerformance, propSlug]);

  const resetForm = () => {
    setEditingId(null);
    setCode('');
    setDiscountType('percent');
    setDiscountValue('');
    setMinSubtotal('');
    setMaxUses('');
    setExpiresAt('');
    setStartsAt('');
    setTouched({});
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (c: Coupon) => {
    setEditingId(c.id);
    setCode(c.code);
    setDiscountType(c.discount_type);
    setDiscountValue(String(c.discount_value));
    setMinSubtotal(c.min_subtotal != null ? String(c.min_subtotal) : '');
    setMaxUses(c.max_uses != null ? String(c.max_uses) : '');
    setExpiresAt(c.expires_at ? c.expires_at.slice(0, 16) : '');
    setStartsAt((c as any).starts_at ? (c as any).starts_at.slice(0, 16) : '');
    setTouched({});
    setShowForm(true);
  };

  const handleSave = async () => {
    // Touch all fields to show all errors
    setTouched({ code: true, discountValue: true, minSubtotal: true, maxUses: true });
    if (Object.keys(validation).length > 0) {
      toast.error('Please Fix The Errors Before Saving.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: Number(discountValue),
        min_subtotal: minSubtotal ? Number(minSubtotal) : null,
        max_uses: maxUses ? Number(maxUses) : null,
        expires_at: expiresAt || null,
        starts_at: startsAt || null,
      };
      const url = editingId ? `/api/agent/coupons/${editingId}` : '/api/agent/coupons';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetchJson<any>(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(res.error || 'Failed To Save Coupon');
      toast.success(editingId ? 'Coupon Updated Successfully' : 'Coupon Created Successfully');
      setShowForm(false);
      resetForm();
      fetchCoupons();
    } catch (err: any) {
      toast.error(err.message || 'Failed To Save Coupon');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (coupon: Coupon) => {
    try {
      const res = await fetchJson<any>(`/api/agent/coupons/${coupon.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...coupon, is_active: !coupon.is_active }),
      });
      if (!res.ok) throw new Error(res.error || 'Failed To Toggle Coupon');
      toast.success(coupon.is_active ? 'Coupon Deactivated' : 'Coupon Activated');
      fetchCoupons();
    } catch (err: any) {
      toast.error(err.message || 'Failed To Toggle Coupon');
    }
  };

  const deleteCoupon = async (couponId: string) => {
    try {
      const res = await fetchJson<any>(`/api/agent/coupons/${couponId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(res.error || 'Failed To Archive Coupon');
      toast.success('Coupon Archived Successfully');
      setConfirmArchiveId(null);
      fetchCoupons();
    } catch (err: any) {
      toast.error(err.message || 'Failed To Archive Coupon');
      setConfirmArchiveId(null);
    }
  };

  const handleBulkGenerate = async (opts: BulkGenerateOptions) => {
    try {
      const res = await fetchJson<{ count?: number }>('/api/agent/coupons/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: opts.prefix,
          count: opts.count,
          discount_type: opts.discount_type,
          discount_value: opts.discount_value,
          min_subtotal: opts.min_subtotal ? Number(opts.min_subtotal) : null,
          max_uses: opts.max_uses ? Number(opts.max_uses) : null,
          expires_at: opts.expires_at || null,
          starts_at: opts.starts_at || null,
        }),
      });
      if (!res.ok) throw new Error(res.error || 'Failed To Bulk Generate Coupons');
      toast.success(`${res.data?.count ?? opts.count} Coupon Codes Generated Successfully`);
      setShowBulkModal(false);
      fetchCoupons();
    } catch (err: any) {
      toast.error(err.message || 'Failed To Bulk Generate Coupons');
    }
  };

  const exportToCSV = () => {
    const csv = exportCSV(
      coupons.map((c) => ({
        code: c.code,
        discount_type: c.discount_type,
        discount_value: c.discount_value,
        min_subtotal: c.min_subtotal ?? '',
        max_uses: c.max_uses ?? 'Unlimited',
        uses_count: c.uses_count,
        is_active: c.is_active,
        expires_at: c.expires_at ?? '',
        created_at: c.created_at,
      })),
      [
        { key: 'code', label: 'Code' },
        { key: 'discount_type', label: 'Type' },
        { key: 'discount_value', label: 'Value' },
        { key: 'min_subtotal', label: 'Min Subtotal' },
        { key: 'max_uses', label: 'Max Uses' },
        { key: 'uses_count', label: 'Uses' },
        { key: 'is_active', label: 'Active' },
        { key: 'expires_at', label: 'Expires' },
        { key: 'created_at', label: 'Created' },
      ]
    );
    downloadCSV('coupons.csv', csv);
  };

  const notifyDownline = async (coupon: Coupon) => {
    try {
      const res = await fetchJson<{ count?: number }>(`/api/agent/coupons/${coupon.id}/notify-downline`, { method: 'POST' });
      if (!res.ok) throw new Error(res.error || 'Failed To Notify Downline');
      toast.success(`Downline Notified - ${res.data?.count ?? 0} Message${res.data?.count === 1 ? '' : 's'} Sent`);
    } catch (err: any) {
      toast.error(err.message || 'Failed To Notify Downline');
    }
  };

  const applyTemplate = (template: 'launch' | 'loyalty' | 'bulk') => {
    if (template === 'launch') {
      setDiscountType('percent');
      setDiscountValue('15');
      setMaxUses('50');
      setMinSubtotal('100');
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setExpiresAt(d.toISOString().slice(0, 16));
    } else if (template === 'loyalty') {
      setDiscountType('fixed');
      setDiscountValue('25');
      setMaxUses('');
      setMinSubtotal('200');
      setExpiresAt('');
    } else {
      setDiscountType('percent');
      setDiscountValue('10');
      setMaxUses('1');
      setMinSubtotal('');
      setExpiresAt('');
    }
  };

  const previewSummary = useMemo(() => {
    if (!discountValue || Number(discountValue) <= 0) return null;
    const val = Number(discountValue);
    const minStr = minSubtotal ? ` On Orders Over $${Number(minSubtotal).toFixed(0)}` : '';
    const usesStr = maxUses ? ` (${maxUses} Use${Number(maxUses) > 1 ? 's' : ''} Max)` : '';
    const expStr = expiresAt ? ` Until ${new Date(expiresAt).toLocaleDateString()}` : '';
    return discountType === 'percent'
      ? `${val}% Off${minStr}${usesStr}${expStr}`
      : `$${val.toFixed(2)} Off${minStr}${usesStr}${expStr}`;
  }, [discountType, discountValue, minSubtotal, maxUses, expiresAt]);

  // Brand palette only: teal family for live / upcoming states, silver for spent
  // or dormant states, red reserved for expiry.
  const couponState = (c: Coupon) => {
    if (c.archived_at) return { label: 'Archived', color: '#5A6A7A', bg: 'rgba(90,106,122,0.10)' };
    if (c.expires_at && new Date(c.expires_at) < new Date())
      return { label: 'Expired', color: '#F87171', bg: 'rgba(248,113,113,0.10)' };
    if (c.max_uses != null && c.uses_count >= c.max_uses)
      return { label: 'Exhausted', color: '#A8B4C0', bg: 'rgba(168,180,192,0.10)' };
    if (!c.is_active) return { label: 'Inactive', color: 'var(--grey-400)', bg: 'rgba(128,128,128,0.08)' };
    if (c.starts_at && new Date(c.starts_at) > new Date())
      return { label: 'Scheduled', color: '#5EEAD4', bg: 'rgba(94,234,212,0.10)' };
    return { label: 'Active', color: '#00C4BC', bg: 'rgba(0,196,188,0.10)' };
  };

  if (loading) return <div style={{ color: 'var(--silver)' }}>Loading Coupons...</div>;
  if (error) return <div style={{ color: 'var(--red)' }}>Error: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {/* Header */}
      <div className="glass-panel stagger-fade-in" style={{ padding: 'var(--space-6)', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-brand)', color: 'var(--white)', fontWeight: 800, margin: 0 }}>Coupon Manager</h2>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginTop: 4 }}>{coupons.length} Coupon{coupons.length !== 1 ? 's' : ''} Configured</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button className="btn-silver" onClick={exportToCSV} style={{ fontSize: '0.8rem' }}>Export CSV</button>
            <button className="btn-silver" onClick={() => setShowBulkModal(true)} style={{ fontSize: '0.8rem' }}>Bulk Generate</button>
            <button className="btn-neon-cyan" onClick={openCreate}>Create Coupon</button>
          </div>
        </div>

        {/* Coupon List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {coupons.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-6)', opacity: 0.5 }}>No Coupons Yet. Create Your First One!</div>
          ) : (
            coupons.map((c) => {
              const state = couponState(c);
              const p = perf[c.code];
              return (
                <div
                  key={c.id}
                  className="glass-panel hover-lift"
                  style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)', background: state.bg, borderRadius: '12px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 800, color: '#00C4BC', letterSpacing: '0.05em' }}>{c.code}</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: state.bg, color: state.color, border: `1px solid ${state.color}` }}>{state.label}</span>
                      </div>
                      <span style={{ fontSize: '0.82rem', color: 'var(--silver)' }}>
                        {c.discount_type === 'percent' ? `${c.discount_value}% Off` : `$${c.discount_value.toFixed(2)} Off`}
                        {c.min_subtotal ? ` On Orders Over $${c.min_subtotal}` : ''}
                      </span>
                      {c.expires_at && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)' }}>Expires: {new Date(c.expires_at).toLocaleDateString()}</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {p && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', marginRight: 4 }}>
                          {p.uses} Use{p.uses !== 1 ? 's' : ''} · ${p.total_discount?.toFixed(2) ?? '0.00'} Discount · ${p.revenue?.toFixed(2) ?? '0.00'} Revenue
                        </span>
                      )}
                      <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)' }}>
                        {c.uses_count} / {c.max_uses ?? '∞'} Uses
                      </span>
                      {storefrontUrl && (
                        <button
                          className="btn-silver"
                          style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                          onClick={() => setQrCoupon(c)}
                        >
                          QR Link
                        </button>
                      )}
                      <button
                        className="btn-silver"
                        style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                        onClick={() => setRedemptionsCoupon(c)}
                      >
                        Redemptions
                      </button>
                      <button
                        className="btn-silver"
                        style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                        onClick={() => notifyDownline(c)}
                      >
                        Notify Downline
                      </button>
                      <button
                        className="btn-silver"
                        style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                        onClick={() => openEdit(c)}
                      >
                        Edit
                      </button>
                      <button
                        className={c.is_active ? 'btn-silver' : 'btn-neon-cyan'}
                        style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                        onClick={() => toggleActive(c)}
                      >
                        {c.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      {confirmArchiveId === c.id ? (
                        <>
                          <button
                            className="btn-neon-red"
                            style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                            onClick={() => deleteCoupon(c.id)}
                          >
                            Confirm Archive
                          </button>
                          <button
                            className="btn-silver"
                            style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                            onClick={() => setConfirmArchiveId(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn-neon-red"
                          style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                          onClick={() => setConfirmArchiveId(c.id)}
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <ModalShell
            title={editingId ? 'Edit Coupon' : 'Create Coupon'}
            onClose={() => { setShowForm(false); resetForm(); }}
          >
            {/* Templates */}
            {!editingId && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginBottom: 8 }}>Quick Templates:</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['launch', 'loyalty', 'bulk'].map((t) => (
                    <button
                      key={t}
                      className="btn-silver"
                      style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                      onClick={() => applyTemplate(t as 'launch' | 'loyalty' | 'bulk')}
                    >
                      {t === 'launch' ? 'Launch (15% Off)' : t === 'loyalty' ? 'Loyalty ($25 Off)' : 'Single-Use (10% Off)'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--grey-300)', display: 'block', marginBottom: 4 }}>Coupon Code *</label>
                <input
                  className="form-input"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24)); touch('code'); }}
                  onBlur={() => touch('code')}
                  placeholder="SUMMER20"
                />
                {touched.code && validation.code && (
                  <p style={{ color: 'var(--red)', fontSize: '0.72rem', marginTop: 4 }}>{validation.code}</p>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--grey-300)', display: 'block', marginBottom: 4 }}>Discount Type *</label>
                  <select className="form-input" value={discountType} onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}>
                    <option value="percent">Percent Off (%)</option>
                    <option value="fixed">Fixed Dollar ($)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--grey-300)', display: 'block', marginBottom: 4 }}>
                    {discountType === 'percent' ? 'Percent Off' : 'Dollar Off'} *
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    value={discountValue}
                    onChange={(e) => { setDiscountValue(e.target.value); touch('discountValue'); }}
                    onBlur={() => touch('discountValue')}
                    step={discountType === 'percent' ? 1 : 0.01}
                    min={0.01}
                    placeholder={discountType === 'percent' ? '10' : '5.00'}
                  />
                  {touched.discountValue && validation.discountValue && (
                    <p style={{ color: 'var(--red)', fontSize: '0.72rem', marginTop: 4 }}>{validation.discountValue}</p>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--grey-300)', display: 'block', marginBottom: 4 }}>Min Subtotal ($)</label>
                  <input
                    className="form-input"
                    type="number"
                    value={minSubtotal}
                    onChange={(e) => { setMinSubtotal(e.target.value); touch('minSubtotal'); }}
                    onBlur={() => touch('minSubtotal')}
                    placeholder="None"
                    step={0.01}
                  />
                  {touched.minSubtotal && validation.minSubtotal && (
                    <p style={{ color: 'var(--red)', fontSize: '0.72rem', marginTop: 4 }}>{validation.minSubtotal}</p>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--grey-300)', display: 'block', marginBottom: 4 }}>Max Uses</label>
                  <input
                    className="form-input"
                    type="number"
                    value={maxUses}
                    onChange={(e) => { setMaxUses(e.target.value); touch('maxUses'); }}
                    onBlur={() => touch('maxUses')}
                    placeholder="Unlimited"
                    min={1}
                  />
                  {touched.maxUses && validation.maxUses && (
                    <p style={{ color: 'var(--red)', fontSize: '0.72rem', marginTop: 4 }}>{validation.maxUses}</p>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--grey-300)', display: 'block', marginBottom: 4 }}>Starts At (Optional)</label>
                  <input className="form-input" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--grey-300)', display: 'block', marginBottom: 4 }}>Expires At (Optional)</label>
                  <input className="form-input" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                </div>
              </div>

              {previewSummary && (
                <div style={{ background: 'rgba(0,196,188,0.06)', border: '1px solid rgba(0,196,188,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem', color: 'var(--teal)' }}>
                  Preview: {previewSummary}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <button className="btn-silver" onClick={() => { setShowForm(false); resetForm(); }} disabled={saving}>Cancel</button>
                <button className="btn-neon-cyan" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : editingId ? 'Update Coupon' : 'Create Coupon'}
                </button>
              </div>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>

      {/* QR Modal */}
      <AnimatePresence>
        {qrCoupon && storefrontUrl && (
          <ModalShell title={`QR Code - ${qrCoupon.code}`} onClose={() => setQrCoupon(null)}>
            <QrModal coupon={qrCoupon} storefront={storefrontUrl} />
          </ModalShell>
        )}
      </AnimatePresence>

      {/* Redemptions Modal */}
      <AnimatePresence>
        {redemptionsCoupon && (
          <ModalShell title={`Redemptions - ${redemptionsCoupon.code}`} onClose={() => setRedemptionsCoupon(null)} wide>
            <RedemptionsModal coupon={redemptionsCoupon} agentSlug={resolvedSlug} />
          </ModalShell>
        )}
      </AnimatePresence>

      {/* Bulk Generate Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <ModalShell title="Bulk Generate Coupons" onClose={() => setShowBulkModal(false)} wide>
            <BulkGenerateModal onGenerate={handleBulkGenerate} onClose={() => setShowBulkModal(false)} />
          </ModalShell>
        )}
      </AnimatePresence>
    </div>
  );
}
