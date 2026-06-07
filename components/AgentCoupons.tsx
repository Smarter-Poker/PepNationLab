'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

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
  starts_at: string | null;
  deleted_at: string | null;
  new_customers_only: boolean | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface PerfEntry { redemptions: number; discount_given: number; revenue_driven: number }

interface RedemptionRow {
  order_id: string;
  buyer_id: string;
  buyer_name: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  status: string;
  created_at: string;
}

interface RedemptionsResponse {
  coupon: Coupon;
  redemptions: RedemptionRow[];
  totals: { count: number; discount_given: number; revenue_driven: number };
}

type FilterMode = 'all' | 'active' | 'inactive' | 'expired' | 'scheduled';

const FONT_LABEL: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  color: 'var(--grey-300)',
  fontSize: '0.78rem',
  fontWeight: 600,
  letterSpacing: '0.02em',
};

const INPUT: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '10px 14px',
  background: 'var(--bg-metal-dark)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: 'var(--white)',
  borderRadius: 8,
  fontSize: '0.95rem',
  outline: 'none',
};

const INPUT_INVALID: React.CSSProperties = {
  ...INPUT,
  border: '1px solid rgba(229,62,62,0.55)',
  boxShadow: '0 0 0 2px rgba(229,62,62,0.12)',
};

const HELPER: React.CSSProperties = {
  fontSize: '0.74rem',
  color: 'var(--grey-500)',
  marginTop: 6,
  lineHeight: 1.4,
};

const HELPER_ERROR: React.CSSProperties = {
  ...HELPER,
  color: '#FFAAAA',
  fontWeight: 600,
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--teal)',
  fontWeight: 700,
  marginBottom: 10,
};

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '-';
  return `$${Number(n).toFixed(2)}`;
}

function fmtDate(s: string | null): string {
  if (!s) return '-';
  try { return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return s; }
}

function fmtDateTime(s: string | null): string {
  if (!s) return '-';
  try {
    return new Date(s).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch { return s; }
}

function generateSuggestion(): string {
  const adj = ['SAVE', 'WELCOME', 'RESEARCH', 'LAUNCH', 'BOOST', 'BONUS', 'PEP'];
  const num = Math.floor(Math.random() * 30) + 5;
  return `${adj[Math.floor(Math.random() * adj.length)]}${num}`;
}

function couponState(c: Coupon): { label: string; color: string; bg: string } {
  if (c.deleted_at) return { label: 'Archived', color: 'var(--grey-400)', bg: 'rgba(168,180,192,0.08)' };
  const now = Date.now();
  const expired = c.expires_at != null && new Date(c.expires_at).getTime() < now;
  const scheduled = c.starts_at != null && new Date(c.starts_at).getTime() > now;
  const exhausted = c.max_uses != null && c.uses_count >= c.max_uses;
  if (expired) return { label: 'Expired', color: '#FFAAAA', bg: 'rgba(229,62,62,0.12)' };
  if (exhausted) return { label: 'Exhausted', color: '#F6AD55', bg: 'rgba(246,173,85,0.12)' };
  if (!c.is_active) return { label: 'Inactive', color: 'var(--grey-400)', bg: 'rgba(168,180,192,0.10)' };
  if (scheduled) return { label: 'Scheduled', color: '#00E5FF', bg: 'rgba(0,229,255,0.12)' };
  return { label: 'Active', color: '#00FF9D', bg: 'rgba(0,255,157,0.12)' };
}

interface AgentCouponsProps {
  agentId: string;
  agentSlug?: string;
}

export default function AgentCoupons({ agentId, agentSlug }: AgentCouponsProps) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [perf, setPerf] = useState<Record<string, PerfEntry>>({});
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [linkCopiedId, setLinkCopiedId] = useState<string | null>(null);
  const [resolvedSlug, setResolvedSlug] = useState<string | null>(agentSlug ?? null);

  // Create form
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [maxUsesPerUser, setMaxUsesPerUser] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [newCustomersOnly, setNewCustomersOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  // Touched state
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  // Modals
  const [qrModalCoupon, setQrModalCoupon] = useState<Coupon | null>(null);
  const [redemptionsModalCoupon, setRedemptionsModalCoupon] = useState<Coupon | null>(null);
  const [redemptionsData, setRedemptionsData] = useState<RedemptionsResponse | null>(null);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [notifyToast, setNotifyToast] = useState<{ couponId: string; text: string } | null>(null);

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/agent/coupons', { cache: 'no-store' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Failed To Load Coupons.');
      }
      const j = await res.json();
      setCoupons(((j.coupons ?? []) as Coupon[]));
    } catch (err) {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('coupons')
          .select('*')
          .eq('agent_id', agentId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });
        setCoupons((data as Coupon[]) ?? []);
      } catch {
        setError(err instanceof Error ? err.message : 'Failed To Load Coupons.');
      }
    } finally {
      setLoading(false);
    }

    try {
      const r = await fetch('/api/agent/coupons/performance', { cache: 'no-store' });
      if (r.ok) {
        const json = await r.json();
        setPerf(json.byCode ?? {});
      }
    } catch { /* best-effort */ }
  }, [agentId]);

  useEffect(() => { loadCoupons(); }, [loadCoupons]);

  // Resolve storefront slug if not passed in via props.
  useEffect(() => {
    if (resolvedSlug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/agent/me', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        const slug = j?.agent?.slug ?? j?.profile?.slug ?? j?.slug ?? null;
        if (!cancelled && typeof slug === 'string' && slug.length > 0) {
          setResolvedSlug(slug);
        }
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [resolvedSlug]);

  // Live validation
  const validation = useMemo(() => {
    const v: Record<string, string> = {};
    const normalizedCode = code.trim().toUpperCase();
    if (code.length === 0) {
      v.code = 'Coupon Code Is Required.';
    } else if (!/^[A-Z0-9-]{3,24}$/.test(normalizedCode)) {
      v.code = 'Use 3-24 Characters: Letters, Numbers, And Hyphens Only.';
    }

    const value = Number(discountValue);
    if (discountValue === '' || !Number.isFinite(value) || value <= 0) {
      v.discountValue = 'Enter A Discount Value Greater Than Zero.';
    } else if (discountType === 'percent' && (value < 1 || value > 90)) {
      v.discountValue = 'Percent Discount Must Be Between 1% And 90%.';
    } else if (discountType === 'fixed' && (value < 1 || value > 500)) {
      v.discountValue = 'Fixed Discount Must Be Between $1 And $500.';
    }

    const min = minOrder.trim() === '' ? null : Number(minOrder);
    if (min !== null && (!Number.isFinite(min) || min < 0)) {
      v.minOrder = 'Minimum Order Must Be Zero Or Greater.';
    }
    if (discountType === 'fixed') {
      if (min === null) {
        v.minOrder = 'Fixed-Amount Coupons Require A Minimum Order.';
      } else if (Number.isFinite(value) && value > min) {
        v.minOrder = `Minimum Order Must Be At Least $${value.toFixed(2)}.`;
      }
    }

    const mu = maxUses.trim() === '' ? null : Number(maxUses);
    if (mu !== null && (!Number.isInteger(mu) || mu < 1)) {
      v.maxUses = 'Use A Whole Number Of One Or More.';
    }

    const mpu = maxUsesPerUser.trim() === '' ? null : Number(maxUsesPerUser);
    if (mpu !== null && (!Number.isInteger(mpu) || mpu < 1)) {
      v.maxUsesPerUser = 'Use A Whole Number Of One Or More.';
    } else if (mpu !== null && mu !== null && mpu > mu) {
      v.maxUsesPerUser = 'Cannot Exceed The Overall Max Uses.';
    }

    if (expiresAt) {
      const t = Date.parse(`${expiresAt}T23:59:59`);
      if (!Number.isFinite(t) || t <= Date.now()) {
        v.expiresAt = 'Expiration Date Must Be In The Future.';
      }
    }
    if (startsAt && expiresAt) {
      const s = Date.parse(`${startsAt}T00:00:00`);
      const e = Date.parse(`${expiresAt}T23:59:59`);
      if (Number.isFinite(s) && Number.isFinite(e) && e <= s) {
        v.expiresAt = 'Expiration Must Be After The Start Date.';
      }
    }

    return v;
  }, [code, discountType, discountValue, minOrder, maxUses, maxUsesPerUser, startsAt, expiresAt]);

  const isValid = Object.keys(validation).length === 0;

  const previewSummary = useMemo(() => {
    if (!isValid) return null;
    const value = Number(discountValue);
    const parts: string[] = [];
    parts.push(discountType === 'percent' ? `${value}% Off The Order Total` : `${fmtMoney(value)} Off The Order`);
    if (minOrder.trim()) parts.push(`Requires A Minimum Order Of ${fmtMoney(Number(minOrder))}`);
    if (maxUses.trim()) parts.push(`Can Be Used ${Number(maxUses)} Time${Number(maxUses) === 1 ? '' : 's'} Total Across All Researchers`);
    if (maxUsesPerUser.trim()) parts.push(`Each Researcher Can Use It ${Number(maxUsesPerUser)} Time${Number(maxUsesPerUser) === 1 ? '' : 's'}`);
    if (startsAt) parts.push(`Activates On ${fmtDate(`${startsAt}T00:00:00`)}`);
    if (expiresAt) parts.push(`Expires On ${fmtDate(`${expiresAt}T23:59:59`)}`);
    if (newCustomersOnly) parts.push('Limited To Researchers Who Have Never Ordered From You');
    return parts;
  }, [isValid, discountType, discountValue, minOrder, maxUses, maxUsesPerUser, startsAt, expiresAt, newCustomersOnly]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setTouched({ code: true, discountValue: true, minOrder: true, maxUses: true, maxUsesPerUser: true, startsAt: true, expiresAt: true });

    if (!isValid) {
      setFormError('Fix The Highlighted Fields Before Creating The Coupon.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/agent/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          discount_type: discountType,
          discount_value: Number(discountValue),
          min_order_amount: minOrder.trim() ? Number(minOrder) : null,
          max_uses: maxUses.trim() ? Number(maxUses) : null,
          max_uses_per_user: maxUsesPerUser.trim() ? Number(maxUsesPerUser) : null,
          starts_at: startsAt || null,
          expires_at: expiresAt || null,
          new_customers_only: newCustomersOnly,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(json.error || 'Failed To Create Coupon.');
        return;
      }
      setCode('');
      setDiscountValue('');
      setMinOrder('');
      setMaxUses('');
      setMaxUsesPerUser('');
      setStartsAt('');
      setExpiresAt('');
      setNewCustomersOnly(false);
      setTouched({});
      await loadCoupons();
    } catch {
      setFormError('Network Error. Please Try Again.');
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(coupon: Coupon) {
    setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? { ...c, is_active: !c.is_active } : c)));
    try {
      const res = await fetch(`/api/agent/coupons/${coupon.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !coupon.is_active }),
      });
      if (!res.ok) throw new Error('PATCH failed');
    } catch {
      setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? { ...c, is_active: coupon.is_active } : c)));
      alert('Failed To Update Coupon.');
    }
  }

  async function deleteCoupon(coupon: Coupon) {
    if (!confirm(`Archive Coupon "${coupon.code}" - Redemption History Is Preserved.\n\nResearchers Will No Longer Be Able To Redeem This Code. Continue?`)) return;
    const previous = coupons;
    setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
    try {
      const res = await fetch(`/api/agent/coupons/${coupon.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('DELETE failed');
    } catch {
      setCoupons(previous);
      alert('Failed To Archive Coupon.');
    }
  }

  function copyCode(coupon: Coupon) {
    navigator.clipboard?.writeText(coupon.code).then(() => {
      setCopiedId(coupon.id);
      setTimeout(() => setCopiedId((id) => (id === coupon.id ? null : id)), 1600);
    }).catch(() => {});
  }

  function buildStorefrontLink(coupon: Coupon): string {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    if (resolvedSlug) return `${origin}/${resolvedSlug}?coupon=${encodeURIComponent(coupon.code)}`;
    return `${origin}/dashboard?coupon=${encodeURIComponent(coupon.code)}`;
  }

  function copyLink(coupon: Coupon) {
    const link = buildStorefrontLink(coupon);
    if (!link) return;
    navigator.clipboard?.writeText(link).then(() => {
      setLinkCopiedId(coupon.id);
      setTimeout(() => setLinkCopiedId((id) => (id === coupon.id ? null : id)), 1800);
    }).catch(() => {});
  }

  async function openRedemptions(coupon: Coupon) {
    setRedemptionsModalCoupon(coupon);
    setRedemptionsData(null);
    setRedemptionsLoading(true);
    try {
      const res = await fetch(`/api/agent/coupons/${coupon.id}/redemptions`, { cache: 'no-store' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Failed To Load Redemptions.');
      }
      const json = (await res.json()) as RedemptionsResponse;
      setRedemptionsData(json);
    } catch (err) {
      setRedemptionsData({
        coupon,
        redemptions: [],
        totals: { count: 0, discount_given: 0, revenue_driven: 0 },
      });
      console.error(err);
    } finally {
      setRedemptionsLoading(false);
    }
  }

  async function notifyDownline(coupon: Coupon) {
    if (notifyingId) return;
    setNotifyingId(coupon.id);
    try {
      const res = await fetch(`/api/agent/coupons/${coupon.id}/notify-downline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotifyToast({ couponId: coupon.id, text: json.error || 'Notification Failed.' });
      } else {
        const sent = typeof json.sent === 'number' ? json.sent : 0;
        const total = typeof json.total === 'number' ? json.total : 0;
        setNotifyToast({ couponId: coupon.id, text: `Notified ${sent} Of ${total} Researchers.` });
      }
    } catch {
      setNotifyToast({ couponId: coupon.id, text: 'Network Error.' });
    } finally {
      setNotifyingId(null);
      setTimeout(() => setNotifyToast((t) => (t && t.couponId === coupon.id ? null : t)), 3500);
    }
  }

  function applyTemplate(template: 'launch' | 'loyalty' | 'bulk') {
    if (template === 'launch') {
      setCode('WELCOME10');
      setDiscountType('percent');
      setDiscountValue('10');
      setMinOrder('');
      setMaxUses('');
      setMaxUsesPerUser('1');
      const d = new Date(); d.setDate(d.getDate() + 30);
      setExpiresAt(d.toISOString().slice(0, 10));
      setStartsAt('');
      setNewCustomersOnly(true);
    } else if (template === 'loyalty') {
      setCode('LOYAL15');
      setDiscountType('percent');
      setDiscountValue('15');
      setMinOrder('100');
      setMaxUses('');
      setMaxUsesPerUser('');
      setStartsAt('');
      setExpiresAt('');
      setNewCustomersOnly(false);
    } else {
      setCode('BULK25');
      setDiscountType('fixed');
      setDiscountValue('25');
      setMinOrder('100');
      setMaxUses('50');
      setMaxUsesPerUser('1');
      const d = new Date(); d.setDate(d.getDate() + 14);
      setExpiresAt(d.toISOString().slice(0, 10));
      setStartsAt('');
      setNewCustomersOnly(false);
    }
  }

  const stats = useMemo(() => {
    let active = 0; let totalRedemptions = 0; let revenueDriven = 0; let discountsGiven = 0;
    for (const c of coupons) {
      const s = couponState(c);
      if (s.label === 'Active') active += 1;
      const p = perf[c.code];
      if (p) {
        totalRedemptions += p.redemptions;
        revenueDriven += p.revenue_driven;
        discountsGiven += p.discount_given;
      } else {
        totalRedemptions += c.uses_count;
      }
    }
    return { active, totalRedemptions, revenueDriven, discountsGiven, total: coupons.length };
  }, [coupons, perf]);

  const filteredCoupons = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    return coupons.filter((c) => {
      const labelOk =
        filter === 'all' ||
        couponState(c).label.toLowerCase() === filter;
      const searchOk = !trimmed || c.code.toLowerCase().includes(trimmed);
      return labelOk && searchOk;
    });
  }, [coupons, filter, search]);

  function exportCsv() {
    const header = ['Code', 'Discount', 'Min Order', 'Uses', 'Max Uses', 'Starts At', 'Expires At', 'New Customers Only', 'State'];
    const rows = filteredCoupons.map((c) => [
      c.code,
      c.discount_type === 'percent' ? `${c.discount_value}%` : `$${Number(c.discount_value).toFixed(2)}`,
      c.min_order_amount != null ? `$${Number(c.min_order_amount).toFixed(2)}` : '',
      String(c.uses_count),
      c.max_uses != null ? String(c.max_uses) : 'Unlimited',
      c.starts_at ? fmtDate(c.starts_at) : '',
      c.expires_at ? fmtDate(c.expires_at) : '',
      c.new_customers_only ? 'Yes' : 'No',
      couponState(c).label,
    ]);
    const escape = (v: string) => {
      const needs = /[",\n]/.test(v);
      const escaped = v.replace(/"/g, '""');
      return needs ? `"${escaped}"` : escaped;
    };
    const csv = [header, ...rows].map((r) => r.map((cell) => escape(String(cell ?? ''))).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coupons-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="glass-panel">
      <div className="" style={{ padding: 'var(--space-6)' }}>
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <h3
            className="metal-text"
            style={{
              fontSize: '1.4rem',
              margin: 0,
              fontFamily: 'var(--font-brand)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Discount Coupons
          </h3>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.88rem', margin: '6px 0 0', lineHeight: 1.5, maxWidth: 720 }}>
            Build Promotional Codes Your Referred Researchers Redeem At Checkout. Schedule Activations, Cap Usage, And Broadcast To Your Downline - Every Rule Is Enforced Server-Side.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-5)',
        }}>
          <StatTile label="Active Coupons" value={String(stats.active)} accent="var(--teal)" />
          <StatTile label="Total Coupons" value={String(stats.total)} />
          <StatTile label="Lifetime Redemptions" value={String(stats.totalRedemptions)} />
          <StatTile label="Revenue Driven" value={fmtMoney(stats.revenueDriven)} accent="#00FF9D" />
          <StatTile label="Discounts Given" value={fmtMoney(stats.discountsGiven)} accent="#F6AD55" />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }} className="coupons-create-grid">
          <form
            onSubmit={handleCreate}
            className="glass-panel"
            style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
          >
            {formError && (
              <div role="alert" aria-live="polite" style={{
                background: 'rgba(229,62,62,0.10)',
                border: '1px solid rgba(229,62,62,0.35)',
                borderRadius: 8,
                padding: 'var(--space-3)',
              }}>
                <p style={{ color: '#FFAAAA', fontSize: '0.86rem', margin: 0 }}>{formError}</p>
              </div>
            )}

            <div>
              <div style={SECTION_LABEL}>1 · Identity</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: 'var(--space-2)',
                alignItems: 'end',
              }}>
                <div>
                  <label htmlFor="coupon-code" style={FONT_LABEL}>Coupon Code</label>
                  <input
                    id="coupon-code"
                    type="text"
                    style={touched.code && validation.code ? INPUT_INVALID : INPUT}
                    placeholder="E.g. RESEARCH10"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                    onBlur={() => markTouched('code')}
                    autoCapitalize="characters"
                    autoComplete="off"
                    required
                    aria-invalid={!!(touched.code && validation.code)}
                  />
                  <p style={touched.code && validation.code ? HELPER_ERROR : HELPER}>
                    {touched.code && validation.code
                      ? validation.code
                      : '3-24 Characters. Letters, Numbers, And Hyphens Only.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setCode(generateSuggestion()); markTouched('code'); }}
                  className="btn-silver"
                  style={{ minHeight: 44, padding: '0 14px', fontSize: '0.82rem', marginBottom: 22, whiteSpace: 'nowrap' }}
                  aria-label="Suggest A Coupon Code"
                >
                  Suggest
                </button>
              </div>
            </div>

            <div>
              <div style={SECTION_LABEL}>2 · Discount</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 'var(--space-3)',
              }}>
                <div>
                  <label htmlFor="discount-type" style={FONT_LABEL}>Discount Type</label>
                  <select
                    id="discount-type"
                    style={INPUT}
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
                  >
                    <option value="percent">Percentage Off</option>
                    <option value="fixed">Fixed Amount Off</option>
                  </select>
                  <p style={HELPER}>
                    {discountType === 'percent' ? 'A Percentage Of The Order Subtotal.' : 'A Flat Dollar Amount Off The Order.'}
                  </p>
                </div>
                <div>
                  <label htmlFor="discount-value" style={FONT_LABEL}>
                    {discountType === 'percent' ? 'Percent Off' : 'Amount Off ($)'}
                  </label>
                  <input
                    id="discount-value"
                    type="number"
                    style={touched.discountValue && validation.discountValue ? INPUT_INVALID : INPUT}
                    min={discountType === 'percent' ? 1 : 1}
                    max={discountType === 'percent' ? 90 : 500}
                    step={discountType === 'percent' ? 1 : 0.01}
                    placeholder={discountType === 'percent' ? '10' : '15.00'}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    onBlur={() => markTouched('discountValue')}
                    required
                    aria-invalid={!!(touched.discountValue && validation.discountValue)}
                    inputMode="decimal"
                  />
                  <p style={touched.discountValue && validation.discountValue ? HELPER_ERROR : HELPER}>
                    {touched.discountValue && validation.discountValue
                      ? validation.discountValue
                      : discountType === 'percent' ? 'Allowed: 1% To 90%.' : 'Allowed: $1 To $500.'}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div style={SECTION_LABEL}>3 · Limits</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 'var(--space-3)',
              }}>
                <div>
                  <label htmlFor="min-order" style={FONT_LABEL}>
                    Minimum Order ($){discountType === 'fixed' && <span style={{ color: 'var(--red, #E53E3E)', marginLeft: 4 }}>*</span>}
                  </label>
                  <input
                    id="min-order"
                    type="number"
                    style={touched.minOrder && validation.minOrder ? INPUT_INVALID : INPUT}
                    min={0}
                    step={0.01}
                    placeholder={discountType === 'fixed' ? `>= ${discountValue || '0.00'}` : 'Optional'}
                    value={minOrder}
                    onChange={(e) => setMinOrder(e.target.value)}
                    onBlur={() => markTouched('minOrder')}
                    aria-invalid={!!(touched.minOrder && validation.minOrder)}
                    inputMode="decimal"
                  />
                  <p style={touched.minOrder && validation.minOrder ? HELPER_ERROR : HELPER}>
                    {touched.minOrder && validation.minOrder
                      ? validation.minOrder
                      : discountType === 'fixed'
                      ? 'Required For Fixed Discounts. Must Be At Least The Discount Amount.'
                      : 'Researchers Must Spend This Much Before The Coupon Applies.'}
                  </p>
                </div>
                <div>
                  <label htmlFor="max-uses" style={FONT_LABEL}>Max Uses (Total)</label>
                  <input
                    id="max-uses"
                    type="number"
                    style={touched.maxUses && validation.maxUses ? INPUT_INVALID : INPUT}
                    min={1}
                    step={1}
                    placeholder="Unlimited"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value.replace(/[^0-9]/g, ''))}
                    onBlur={() => markTouched('maxUses')}
                    aria-invalid={!!(touched.maxUses && validation.maxUses)}
                    inputMode="numeric"
                  />
                  <p style={touched.maxUses && validation.maxUses ? HELPER_ERROR : HELPER}>
                    {touched.maxUses && validation.maxUses
                      ? validation.maxUses
                      : 'Total Redemptions Across All Researchers. Leave Blank For Unlimited.'}
                  </p>
                </div>
                <div>
                  <label htmlFor="max-per-user" style={FONT_LABEL}>Max Uses Per Researcher</label>
                  <input
                    id="max-per-user"
                    type="number"
                    style={touched.maxUsesPerUser && validation.maxUsesPerUser ? INPUT_INVALID : INPUT}
                    min={1}
                    step={1}
                    placeholder="Unlimited"
                    value={maxUsesPerUser}
                    onChange={(e) => setMaxUsesPerUser(e.target.value.replace(/[^0-9]/g, ''))}
                    onBlur={() => markTouched('maxUsesPerUser')}
                    aria-invalid={!!(touched.maxUsesPerUser && validation.maxUsesPerUser)}
                    inputMode="numeric"
                  />
                  <p style={touched.maxUsesPerUser && validation.maxUsesPerUser ? HELPER_ERROR : HELPER}>
                    {touched.maxUsesPerUser && validation.maxUsesPerUser
                      ? validation.maxUsesPerUser
                      : 'How Many Times One Researcher Can Use It.'}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div style={SECTION_LABEL}>4 · Audience</div>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: 'var(--space-3)',
                borderRadius: 8,
                background: 'rgba(0,229,255,0.04)',
                border: '1px solid rgba(0,229,255,0.16)',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={newCustomersOnly}
                  onChange={(e) => setNewCustomersOnly(e.target.checked)}
                  style={{ marginTop: 3, accentColor: '#00E5FF' }}
                />
                <span>
                  <strong style={{ display: 'block', color: 'var(--white)', fontSize: '0.88rem', marginBottom: 2 }}>
                    Limit To New Customers Only
                  </strong>
                  <span style={{ fontSize: '0.76rem', color: 'var(--grey-400)', lineHeight: 1.4 }}>
                    Researchers Who Have Never Placed An Order With You. Repeat Buyers Will Be Blocked At Checkout.
                  </span>
                </span>
              </label>
            </div>

            <div>
              <div style={SECTION_LABEL}>5 · Validity</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 'var(--space-3)',
              }}>
                <div>
                  <label htmlFor="starts-at" style={FONT_LABEL}>Starts On</label>
                  <input
                    id="starts-at"
                    type="date"
                    style={INPUT}
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    onBlur={() => markTouched('startsAt')}
                  />
                  <p style={HELPER}>Leave Blank For Immediate Activation.</p>
                </div>
                <div>
                  <label htmlFor="expires-at" style={FONT_LABEL}>Expires On</label>
                  <input
                    id="expires-at"
                    type="date"
                    style={touched.expiresAt && validation.expiresAt ? INPUT_INVALID : INPUT}
                    min={todayIso}
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    onBlur={() => markTouched('expiresAt')}
                    aria-invalid={!!(touched.expiresAt && validation.expiresAt)}
                  />
                  <p style={touched.expiresAt && validation.expiresAt ? HELPER_ERROR : HELPER}>
                    {touched.expiresAt && validation.expiresAt
                      ? validation.expiresAt
                      : 'Leave Blank For No Expiration. Coupon Expires At 11:59 PM On The Selected Date.'}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn-neon-cyan"
              disabled={creating}
              style={{ minHeight: 48, fontSize: '0.95rem', fontWeight: 700, marginTop: 4 }}
            >
              {creating ? 'Creating Coupon…' : 'Create Coupon'}
            </button>
          </form>

          <div
            className="glass-panel"
            style={{ padding: 'var(--space-5)' }}
            aria-live="polite"
          >
            <div style={SECTION_LABEL}>Live Preview</div>
            <div
              style={{
                background: 'var(--bg-glass-teal)',
                border: '1px dashed rgba(0,229,255,0.35)',
                borderRadius: 12,
                padding: 'var(--space-5)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fontSize: '1.6rem',
                  color: code ? 'var(--teal)' : 'var(--grey-500)',
                  letterSpacing: '0.12em',
                  marginBottom: 8,
                  wordBreak: 'break-all',
                }}
              >
                {code || 'YOUR-CODE'}
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--white)' }}>
                {discountType === 'percent'
                  ? `${discountValue || '0'}% Off`
                  : `${fmtMoney(Number(discountValue) || 0)} Off`}
              </div>
            </div>

            {previewSummary ? (
              <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {previewSummary.map((line, i) => (
                  <li key={i} style={{ fontSize: '0.82rem', color: 'var(--silver)', paddingLeft: 18, position: 'relative', lineHeight: 1.4 }}>
                    <span style={{ position: 'absolute', left: 0, top: 8, width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)' }} />
                    {line}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: '0.82rem', color: 'var(--grey-500)', marginTop: 14, marginBottom: 0, lineHeight: 1.5 }}>
                Fill In The Form Above To See How This Coupon Will Behave At Checkout.
              </p>
            )}

            {coupons.length === 0 && (
              <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ ...SECTION_LABEL, color: 'var(--silver)', marginBottom: 8 }}>Starter Templates</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button type="button" onClick={() => applyTemplate('launch')} className="btn-silver" style={{ textAlign: 'left', fontSize: '0.8rem', padding: '8px 12px', minHeight: 0 }}>
                    Welcome 10% - First-Time Researchers, 30 Days
                  </button>
                  <button type="button" onClick={() => applyTemplate('loyalty')} className="btn-silver" style={{ textAlign: 'left', fontSize: '0.8rem', padding: '8px 12px', minHeight: 0 }}>
                    Loyalty 15% - Orders Over $100, No Expiration
                  </button>
                  <button type="button" onClick={() => applyTemplate('bulk')} className="btn-silver" style={{ textAlign: 'left', fontSize: '0.8rem', padding: '8px 12px', minHeight: 0 }}>
                    Bulk $25 Off - Capped At 50 Uses, 14 Days
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* LIST CONTROLS */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, minWidth: 220 }}>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Codes…"
              aria-label="Search Coupon Codes"
              style={{ ...INPUT, minHeight: 40, padding: '8px 12px', fontSize: '0.85rem', maxWidth: 280 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-silver"
              onClick={() => setBulkModalOpen(true)}
              style={{ fontSize: '0.78rem', padding: '8px 14px', minHeight: 38 }}
            >
              Bulk Generate
            </button>
            <button
              type="button"
              className="btn-silver"
              onClick={exportCsv}
              disabled={filteredCoupons.length === 0}
              style={{ fontSize: '0.78rem', padding: '8px 14px', minHeight: 38, opacity: filteredCoupons.length === 0 ? 0.5 : 1 }}
            >
              Export CSV
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <div style={{ ...SECTION_LABEL, margin: 0 }}>Your Coupons</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['all', 'active', 'scheduled', 'inactive', 'expired'] as FilterMode[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                style={{
                  minHeight: 36,
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: filter === f ? 'var(--teal)' : 'var(--surface-1, #0F1923)',
                  color: filter === f ? 'var(--black)' : 'var(--silver)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : error ? (
          <div className="glass-panel" style={{ border: '1px solid rgba(229,62,62,0.3)', padding: 'var(--space-4)' }}>
            <p style={{ color: '#FFAAAA', fontSize: '0.85rem', margin: 0 }}>{error}</p>
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div style={{
            border: '1px dashed rgba(255,255,255,0.10)',
            borderRadius: 12,
            padding: 'var(--space-7) var(--space-5)',
            textAlign: 'center',
          }}>
            <p style={{ color: 'var(--white)', fontSize: '0.96rem', margin: '0 0 6px', fontWeight: 600 }}>
              {coupons.length === 0 ? 'No Coupons Yet' : `No ${filter.charAt(0).toUpperCase() + filter.slice(1)} Coupons`}
            </p>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.84rem', margin: 0, lineHeight: 1.5 }}>
              {coupons.length === 0
                ? 'Create Your First Coupon Above. Try A Starter Template To Get Going Fast.'
                : 'Switch Filters, Clear Your Search, Or Create A New Coupon To Fill This List.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {filteredCoupons.map((c) => {
              const state = couponState(c);
              const usesLabel = c.max_uses != null
                ? `${c.uses_count} / ${c.max_uses} Uses`
                : `${c.uses_count} ${c.uses_count === 1 ? 'Use' : 'Uses'}`;
              const usagePct = c.max_uses != null && c.max_uses > 0
                ? Math.min(100, Math.round((c.uses_count / c.max_uses) * 100))
                : null;
              const toast = notifyToast && notifyToast.couponId === c.id ? notifyToast.text : null;
              const linkCopied = linkCopiedId === c.id;
              return (
                <div
                  key={c.id}
                  className="glass-panel"
                  style={{
                    padding: 'var(--space-4)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: 'var(--space-3)',
                    alignItems: 'center',
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => copyCode(c)}
                          title="Copy Code"
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '1.05rem',
                            fontWeight: 700,
                            color: 'var(--teal)',
                            background: 'rgba(0,196,188,0.08)',
                            border: '1px solid rgba(0,196,188,0.25)',
                            borderRadius: 6,
                            padding: '4px 10px',
                            cursor: 'pointer',
                            letterSpacing: '0.05em',
                            minHeight: 32,
                          }}
                        >
                          {c.code}
                        </button>
                        {copiedId === c.id && (
                          <span style={{ fontSize: '0.74rem', color: '#00FF9D', fontWeight: 700 }}>Copied</span>
                        )}
                        <span
                          style={{
                            fontSize: '0.66rem',
                            padding: '3px 10px',
                            borderRadius: 999,
                            background: state.bg,
                            color: state.color,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            border: `1px solid ${state.color}55`,
                          }}
                        >
                          {state.label}
                        </span>
                        {c.new_customers_only && (
                          <span style={{
                            fontSize: '0.62rem',
                            padding: '3px 8px',
                            borderRadius: 999,
                            background: 'rgba(0,229,255,0.10)',
                            color: '#00E5FF',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            border: '1px solid rgba(0,229,255,0.35)',
                          }}>New Customers</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 8, flexWrap: 'wrap', fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--white)', fontWeight: 600 }}>
                          {c.discount_type === 'percent'
                            ? `${Number(c.discount_value)}% Off`
                            : `${fmtMoney(c.discount_value)} Off`}
                        </span>
                        {c.min_order_amount != null && (
                          <span style={{ color: 'var(--grey-400)' }}>Min Order {fmtMoney(c.min_order_amount)}</span>
                        )}
                        <span style={{ color: 'var(--grey-400)' }}>{usesLabel}</span>
                        {c.max_uses_per_user != null && (
                          <span style={{ color: 'var(--grey-400)' }}>{c.max_uses_per_user}/Researcher</span>
                        )}
                        {c.starts_at && (
                          <span style={{ color: 'var(--grey-400)' }}>Starts {fmtDate(c.starts_at)}</span>
                        )}
                        <span style={{ color: 'var(--grey-400)' }}>
                          Expires {c.expires_at ? fmtDate(c.expires_at) : 'Never'}
                        </span>
                      </div>

                      {usagePct != null && (
                        <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999, height: 4, overflow: 'hidden' }}>
                          <div style={{
                            width: `${usagePct}%`,
                            height: '100%',
                            background: usagePct >= 90 ? '#F6AD55' : 'var(--teal)',
                            transition: 'width 200ms ease-out',
                          }} />
                        </div>
                      )}

                      {perf[c.code] && perf[c.code].redemptions > 0 && (
                        <div style={{ fontSize: '0.74rem', color: '#00FF9D', marginTop: 8, fontWeight: 600 }}>
                          {`Drove ${fmtMoney(perf[c.code].revenue_driven)} In Revenue · ${fmtMoney(perf[c.code].discount_given)} Discounted Across ${perf[c.code].redemptions} Order${perf[c.code].redemptions !== 1 ? 's' : ''}`}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => toggleActive(c)}
                        className="btn-silver"
                        style={{ fontSize: '0.76rem', padding: '8px 12px', minHeight: 36 }}
                        aria-label={c.is_active ? `Deactivate ${c.code}` : `Activate ${c.code}`}
                      >
                        {c.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCoupon(c)}
                        className="btn-neon-red"
                        style={{ fontSize: '0.76rem', padding: '8px 12px', minHeight: 36 }}
                        aria-label={`Archive ${c.code}`}
                      >
                        Archive
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 'var(--space-3)' }}>
                    <button
                      type="button"
                      className="btn-silver"
                      onClick={() => copyLink(c)}
                      style={{ fontSize: '0.74rem', padding: '6px 12px', minHeight: 32 }}
                    >
                      {linkCopied ? 'Link Copied' : 'Copy Link'}
                    </button>
                    <button
                      type="button"
                      className="btn-silver"
                      onClick={() => setQrModalCoupon(c)}
                      style={{ fontSize: '0.74rem', padding: '6px 12px', minHeight: 32 }}
                    >
                      QR
                    </button>
                    <button
                      type="button"
                      className="btn-silver"
                      onClick={() => openRedemptions(c)}
                      style={{ fontSize: '0.74rem', padding: '6px 12px', minHeight: 32 }}
                    >
                      Redemptions
                    </button>
                    <button
                      type="button"
                      className="btn-silver"
                      onClick={() => notifyDownline(c)}
                      disabled={notifyingId === c.id}
                      style={{ fontSize: '0.74rem', padding: '6px 12px', minHeight: 32, opacity: notifyingId === c.id ? 0.6 : 1 }}
                    >
                      {notifyingId === c.id ? 'Sending…' : 'Send To Researchers'}
                    </button>
                    {toast && (
                      <span style={{ fontSize: '0.74rem', color: 'var(--teal)', fontWeight: 600 }}>{toast}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @media (min-width: 900px) {
            .coupons-create-grid { grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr) !important; }
          }
        `}</style>
      </div>

      {qrModalCoupon && (
        <QrModal
          coupon={qrModalCoupon}
          onClose={() => setQrModalCoupon(null)}
        />
      )}

      {redemptionsModalCoupon && (
        <RedemptionsModal
          coupon={redemptionsModalCoupon}
          data={redemptionsData}
          loading={redemptionsLoading}
          onClose={() => { setRedemptionsModalCoupon(null); setRedemptionsData(null); }}
        />
      )}

      {bulkModalOpen && (
        <BulkGenerateModal
          onClose={() => setBulkModalOpen(false)}
          onCreated={async () => { await loadCoupons(); setBulkModalOpen(false); }}
        />
      )}
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10,
      padding: '12px 14px',
    }}>
      <div style={{ fontSize: '0.66rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: accent || 'var(--white)', marginTop: 4, lineHeight: 1.2 }}>
        {value}
      </div>
    </div>
  );
}

// -------- MODALS --------

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
}

function ModalShell({ title, onClose, children, footer, maxWidth = 560 }: ModalShellProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5,10,15,0.85)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-3)',
      }}
    >
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 'var(--space-5)',
          background: 'linear-gradient(180deg, #0f1923 0%, #0a131c 100%)',
          borderRadius: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)', gap: 'var(--space-3)' }}>
          <h4 className="metal-text" style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {title}
          </h4>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn-silver"
            style={{ minHeight: 32, minWidth: 32, padding: '0 10px', fontSize: '0.9rem', fontWeight: 700 }}
          >
            X
          </button>
        </div>
        {children}
        {footer && (
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function QrModal({ coupon, onClose }: { coupon: Coupon; onClose: () => void }) {
  const qrUrl = `/api/agent/coupons/${coupon.id}/qr`;
  return (
    <ModalShell title={`QR · ${coupon.code}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div style={{
          background: '#FFFFFF',
          padding: 16,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: '100%',
        }}>
          <Image
            src={qrUrl}
            alt={`QR Code For ${coupon.code}`}
            width={280}
            height={280}
            style={{ width: '100%', maxWidth: 280, height: 'auto', display: 'block' }}
            unoptimized
          />
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', margin: 0, textAlign: 'center', lineHeight: 1.5 }}>
          Scan To Open Your Storefront With The Coupon Pre-Applied.
        </p>
        <a
          href={qrUrl}
          download={`coupon-${coupon.code}.png`}
          className="btn-neon-cyan"
          style={{ minHeight: 40, padding: '8px 16px', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          Download PNG
        </a>
      </div>
    </ModalShell>
  );
}

function RedemptionsModal({
  coupon,
  data,
  loading,
  onClose,
}: {
  coupon: Coupon;
  data: RedemptionsResponse | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <ModalShell title={`Redemptions · ${coupon.code}`} onClose={onClose} maxWidth={720}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-6)' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : !data ? (
        <p style={{ color: '#FFAAAA', fontSize: '0.86rem' }}>Failed To Load Redemptions.</p>
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-4)',
          }}>
            <StatTile label="Redemptions" value={String(data.totals.count)} />
            <StatTile label="Discount Given" value={fmtMoney(data.totals.discount_given)} accent="#F6AD55" />
            <StatTile label="Revenue Driven" value={fmtMoney(data.totals.revenue_driven)} accent="#00FF9D" />
          </div>
          {data.redemptions.length === 0 ? (
            <p style={{ color: 'var(--grey-400)', fontSize: '0.86rem', textAlign: 'center', padding: 'var(--space-4) 0' }}>
              No Redemptions Yet.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.82rem',
                color: 'var(--silver)',
              }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 6px', color: 'var(--grey-400)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Researcher</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px', color: 'var(--grey-400)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Order</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px', color: 'var(--grey-400)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--grey-400)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Subtotal</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--grey-400)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Discount</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--grey-400)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px', color: 'var(--grey-400)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.redemptions.map((r) => (
                    <tr key={r.order_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '8px 6px', color: 'var(--white)' }}>{r.buyer_name || '-'}</td>
                      <td style={{ padding: '8px 6px', fontFamily: 'monospace' }}>{r.order_id.slice(0, 8)}</td>
                      <td style={{ padding: '8px 6px' }}>{fmtDateTime(r.created_at)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right' }}>{fmtMoney(r.subtotal)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', color: '#F6AD55' }}>-{fmtMoney(r.discount_amount)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--white)', fontWeight: 600 }}>{fmtMoney(r.total)}</td>
                      <td style={{ padding: '8px 6px', textTransform: 'capitalize' }}>{r.status.replace(/_/g, ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </ModalShell>
  );
}

function BulkGenerateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [prefix, setPrefix] = useState('');
  const [count, setCount] = useState('25');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [maxUsesPerUser, setMaxUsesPerUser] = useState('1');
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [newCustomersOnly, setNewCustomersOnly] = useState(false);
  const [singleUse, setSingleUse] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const cleanPrefix = prefix.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const n = parseInt(count, 10);
    const dv = Number(discountValue);
    if (!/^[A-Z0-9-]{2,12}$/.test(cleanPrefix)) {
      setError('Prefix Must Be 2-12 Letters/Numbers/Hyphens.');
      return;
    }
    if (!Number.isInteger(n) || n < 1 || n > 500) {
      setError('Count Must Be Between 1 And 500.');
      return;
    }
    if (!Number.isFinite(dv) || dv <= 0) {
      setError('Enter A Discount Value Greater Than Zero.');
      return;
    }
    if (discountType === 'fixed' && !minOrder.trim()) {
      setError('Fixed-Amount Coupons Require A Minimum Order.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/agent/coupons/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prefix: cleanPrefix,
          count: n,
          discount_type: discountType,
          discount_value: dv,
          min_order_amount: minOrder.trim() ? Number(minOrder) : null,
          max_uses_per_user: maxUsesPerUser.trim() ? Number(maxUsesPerUser) : null,
          starts_at: startsAt || null,
          expires_at: expiresAt || null,
          new_customers_only: newCustomersOnly,
          single_use: singleUse,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Bulk Generation Failed.');
        return;
      }
      onCreated();
    } catch {
      setError('Network Error. Please Try Again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="Bulk Generate Coupons" onClose={onClose} maxWidth={560}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {error && (
          <div role="alert" style={{ background: 'rgba(229,62,62,0.10)', border: '1px solid rgba(229,62,62,0.35)', borderRadius: 8, padding: 'var(--space-2) var(--space-3)' }}>
            <p style={{ color: '#FFAAAA', fontSize: '0.82rem', margin: 0 }}>{error}</p>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-2)' }}>
          <div>
            <label style={FONT_LABEL}>Prefix</label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
              placeholder="LAUNCH"
              style={INPUT}
              autoCapitalize="characters"
              autoComplete="off"
              required
            />
            <p style={HELPER}>Each Code Will Look Like {prefix || 'LAUNCH'}-XXXXXX.</p>
          </div>
          <div>
            <label style={FONT_LABEL}>Count</label>
            <input
              type="number"
              value={count}
              onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ''))}
              min={1}
              max={500}
              step={1}
              style={INPUT}
              inputMode="numeric"
              required
            />
            <p style={HELPER}>1 To 500 Codes Per Batch.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-2)' }}>
          <div>
            <label style={FONT_LABEL}>Discount Type</label>
            <select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')} style={INPUT}>
              <option value="percent">Percentage Off</option>
              <option value="fixed">Fixed Amount Off</option>
            </select>
          </div>
          <div>
            <label style={FONT_LABEL}>{discountType === 'percent' ? 'Percent Off' : 'Amount Off ($)'}</label>
            <input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              min={1}
              max={discountType === 'percent' ? 90 : 500}
              step={discountType === 'percent' ? 1 : 0.01}
              placeholder={discountType === 'percent' ? '10' : '25.00'}
              style={INPUT}
              inputMode="decimal"
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-2)' }}>
          <div>
            <label style={FONT_LABEL}>Minimum Order ($)</label>
            <input
              type="number"
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              min={0}
              step={0.01}
              placeholder="Optional"
              style={INPUT}
              inputMode="decimal"
            />
          </div>
          <div>
            <label style={FONT_LABEL}>Max Uses Per Researcher</label>
            <input
              type="number"
              value={maxUsesPerUser}
              onChange={(e) => setMaxUsesPerUser(e.target.value.replace(/[^0-9]/g, ''))}
              min={1}
              step={1}
              placeholder="Unlimited"
              style={INPUT}
              inputMode="numeric"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-2)' }}>
          <div>
            <label style={FONT_LABEL}>Starts On</label>
            <input
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              style={INPUT}
            />
          </div>
          <div>
            <label style={FONT_LABEL}>Expires On</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              style={INPUT}
            />
          </div>
        </div>

        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 'var(--space-2) var(--space-3)',
          borderRadius: 8,
          background: 'rgba(0,229,255,0.04)',
          border: '1px solid rgba(0,229,255,0.16)',
          cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={newCustomersOnly}
            onChange={(e) => setNewCustomersOnly(e.target.checked)}
            style={{ accentColor: '#00E5FF' }}
          />
          <span style={{ fontSize: '0.82rem', color: 'var(--white)' }}>Limit To New Customers Only</span>
        </label>

        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 'var(--space-2) var(--space-3)',
          borderRadius: 8,
          background: 'rgba(0,196,188,0.04)',
          border: '1px solid rgba(0,196,188,0.16)',
          cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={singleUse}
            onChange={(e) => setSingleUse(e.target.checked)}
            style={{ accentColor: 'var(--teal)' }}
          />
          <span style={{ fontSize: '0.82rem', color: 'var(--white)' }}>Single-Use (Each Code Can Be Redeemed Once)</span>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
          <button type="button" className="btn-silver" onClick={onClose} disabled={submitting} style={{ minHeight: 40, padding: '8px 16px', fontSize: '0.85rem' }}>
            Cancel
          </button>
          <button type="submit" className="btn-neon-cyan" disabled={submitting} style={{ minHeight: 40, padding: '8px 16px', fontSize: '0.85rem', fontWeight: 700 }}>
            {submitting ? 'Generating…' : 'Generate Codes'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
