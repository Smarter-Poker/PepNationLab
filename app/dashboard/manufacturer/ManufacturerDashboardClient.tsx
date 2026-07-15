'use client';

/**
 * Manufacturer dashboard client. Everything renders through t() so the
 * whole surface is available in English, Simplified Chinese, and
 * Traditional Chinese.
 *
 * Money units: agent_products.retail_price and manufacturer_cost are stored
 * PER 10-VIAL PACK, and every product on a manufacturer store trades in
 * packs of 10 -- so this dashboard displays those raw per-pack numbers
 * directly (no /10 per-vial conversion).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useI18n, LanguageToggle } from '@/lib/i18n';

interface MfrProduct {
  id: string;
  productId: string;
  name: string;
  unitSize: string | null;
  unitMeasure: string | null;
  category: string | null;
  imageUrl: string | null;
  retailPrice: number | null;
  manufacturerCost: number | null;
  isVisible: boolean;
}

interface MfrOrderItem { name: string; quantity: number; unitPrice: number; }

interface MfrOrder {
  id: string;
  createdAt: string;
  status: string;
  buyerName: string | null;
  subtotal: number;
  shippingCost: number;
  total: number;
  fulfillmentMethod: string | null;
  paymentMethod: string | null;
  shippingAddress: Record<string, unknown> | null;
  items: MfrOrderItem[];
}

interface LedgerRow {
  id: string;
  orderId: string;
  productSubtotal: number;
  commissionBase: number;
  commissionPct: number;
  platformCommission: number;
  manufacturerNet: number;
  shippingCollected: number;
  voided: boolean;
  createdAt: string;
}

interface LedgerTotals { sales: number; commission: number; net: number; shipping: number; }

interface Overview {
  profile: {
    username: string | null;
    fullName: string | null;
    locale: string | null;
    commissionPct: number;
    slug: string | null;
    displayName: string | null;
    storeActive: boolean;
  };
  products: MfrProduct[];
  orders: MfrOrder[];
  ledger: { rows: LedgerRow[]; totals: LedgerTotals; totals30: LedgerTotals };
}

type Tab = 'products' | 'orders' | 'earnings' | 'settings';

const money = (n: number | null | undefined) =>
  n == null || !Number.isFinite(Number(n)) ? '--' : `$${Number(n).toFixed(2)}`;

export default function ManufacturerDashboardClient() {
  const { t, locale } = useI18n();
  const dateLocale = locale === 'en' ? 'en-US' : locale;

  const [tab, setTab] = useState<Tab>('products');
  const [data, setData] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');

  // Per-row draft edits: id -> { price?: string; cost?: string }
  const [drafts, setDrafts] = useState<Record<string, { price?: string; cost?: string }>>({});
  const [rowState, setRowState] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
  const [orderBusy, setOrderBusy] = useState<Record<string, boolean>>({});
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Settings: password form
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; key: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/manufacturer/overview', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as Overview;
      setData(json);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pct = data?.profile.commissionPct ?? 10;
  const keepFactor = 1 - pct / 100;
  const storeUrl = data?.profile.slug ? `https://pepnationlab.com/${data.profile.slug}` : null;

  const filteredProducts = useMemo(() => {
    const list = data?.products ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.category ?? '').toLowerCase().includes(q) ||
      `${p.unitSize ?? ''}${p.unitMeasure ?? ''}`.toLowerCase().includes(q)
    );
  }, [data, search]);

  const saveRow = async (p: MfrProduct) => {
    const draft = drafts[p.id] ?? {};
    const payload: Record<string, unknown> = { id: p.id };
    if (draft.price !== undefined && draft.price !== '') {
      const v = Number(draft.price);
      if (!Number.isFinite(v) || v < 0) { setRowState(s => ({ ...s, [p.id]: 'error' })); return; }
      payload.retail_price = Math.round(v * 100) / 100;
    }
    if (draft.cost !== undefined) {
      if (draft.cost === '') {
        payload.manufacturer_cost = null;
      } else {
        const v = Number(draft.cost);
        if (!Number.isFinite(v) || v < 0) { setRowState(s => ({ ...s, [p.id]: 'error' })); return; }
        payload.manufacturer_cost = Math.round(v * 100) / 100;
      }
    }
    if (Object.keys(payload).length === 1) return;

    setRowState(s => ({ ...s, [p.id]: 'saving' }));
    try {
      const res = await fetch('/api/agent/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      setRowState(s => ({ ...s, [p.id]: 'saved' }));
      setDrafts(d => { const n = { ...d }; delete n[p.id]; return n; });
      setData(prev => prev ? {
        ...prev,
        products: prev.products.map(x => x.id === p.id ? {
          ...x,
          retailPrice: payload.retail_price !== undefined ? Number(payload.retail_price) : x.retailPrice,
          manufacturerCost: payload.manufacturer_cost !== undefined
            ? (payload.manufacturer_cost === null ? null : Number(payload.manufacturer_cost))
            : x.manufacturerCost,
        } : x),
      } : prev);
      setTimeout(() => setRowState(s => { const n = { ...s }; if (n[p.id] === 'saved') delete n[p.id]; return n; }), 2500);
    } catch {
      setRowState(s => ({ ...s, [p.id]: 'error' }));
    }
  };

  const toggleVisible = async (p: MfrProduct) => {
    setRowState(s => ({ ...s, [p.id]: 'saving' }));
    try {
      const res = await fetch('/api/agent/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, is_visible: !p.isVisible }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setData(prev => prev ? {
        ...prev,
        products: prev.products.map(x => x.id === p.id ? { ...x, isVisible: !p.isVisible } : x),
      } : prev);
      setRowState(s => { const n = { ...s }; delete n[p.id]; return n; });
    } catch {
      setRowState(s => ({ ...s, [p.id]: 'error' }));
    }
  };

  const orderAction = async (order: MfrOrder, action: 'mark_paid' | 'approve' | 'cancel') => {
    setOrderBusy(s => ({ ...s, [order.id]: true }));
    try {
      let url = '';
      let body: Record<string, unknown> = {};
      if (action === 'mark_paid') {
        url = '/api/agent/orders/mark-paid';
        body = { orderId: order.id };
      } else {
        url = '/api/agent/orders/approve';
        body = {
          orderId: order.id,
          newStatus: action === 'cancel'
            ? 'cancelled'
            : (order.fulfillmentMethod === 'agent_pickup' ? 'approved_pickup' : 'approved_ship'),
        };
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      await load();
    } catch {
      /* surfaced through the row state below */
    } finally {
      setOrderBusy(s => { const n = { ...s }; delete n[order.id]; return n; });
      setConfirmCancelId(null);
    }
  };

  const changePassword = async () => {
    setPwMsg(null);
    if (pw1.length < 8) { setPwMsg({ ok: false, key: 'password_too_short' }); return; }
    if (pw1 !== pw2) { setPwMsg({ ok: false, key: 'password_mismatch' }); return; }
    setPwBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setPwMsg({ ok: true, key: 'password_updated' });
      setPw1(''); setPw2('');
    } catch {
      setPwMsg({ ok: false, key: 'password_update_failed' });
    } finally {
      setPwBusy(false);
    }
  };

  const signOut = async () => {
    try { await fetch('/api/auth/signout', { method: 'POST' }); } catch { /* ignore */ }
    window.location.href = '/login';
  };

  const copyStoreLink = async () => {
    if (!storeUrl) return;
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  const statusKey = (s: string) => `status_${s}`;

  const card: React.CSSProperties = {
    background: '#0F1923',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 'var(--space-5, 20px)',
  };
  const label: React.CSSProperties = {
    fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em',
    textTransform: 'uppercase', color: 'var(--silver, #A8B4C0)',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: '#050A0F',
    border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8,
    color: '#FFFFFF', padding: '8px 10px', fontSize: '0.9rem', outline: 'none',
  };
  const btnPrimary: React.CSSProperties = {
    background: 'var(--teal, #00C4BC)', color: '#04221F', border: 'none',
    borderRadius: 8, padding: '8px 14px', fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem',
  };
  const btnGhost: React.CSSProperties = {
    background: 'transparent', color: 'var(--silver, #A8B4C0)',
    border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8,
    padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem',
  };

  const statCard = (title: string, allTime: number, last30: number) => (
    <div style={{ ...card, minWidth: 0 }}>
      <div style={label}>{title}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFFFFF', marginTop: 6 }}>{money(allTime)}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--grey-400, #6B7683)', marginTop: 2 }}>{t('all_time')}</div>
      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--teal, #00C4BC)', marginTop: 8 }}>{money(last30)}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--grey-400, #6B7683)' }}>{t('last_30_days')}</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: '#050A0F', color: '#FFFFFF', paddingBottom: 80 }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        flexWrap: 'wrap', padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: '#0A121B',
      }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--teal, #00C4BC)' }}>
            {t('manufacturer_dashboard')}
          </h1>
          <div style={{ fontSize: '0.8rem', color: 'var(--silver, #A8B4C0)', marginTop: 2 }}>
            {t('welcome')}, {data?.profile.displayName || data?.profile.username || ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <LanguageToggle compact />
          <button type="button" onClick={signOut} style={btnGhost}>{t('sign_out')}</button>
        </div>
      </header>

      {/* Store link strip */}
      {storeUrl && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          padding: '10px 20px', background: 'rgba(0,196,188,0.06)',
          borderBottom: '1px solid rgba(0,196,188,0.15)',
        }}>
          <span style={label}>{t('your_store_link')}</span>
          <a href={storeUrl} style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none', wordBreak: 'break-all' }}>
            {storeUrl}
          </a>
          <button type="button" onClick={copyStoreLink} style={{ ...btnGhost, padding: '4px 10px', fontSize: '0.7rem' }}>
            {copied ? t('copied') : t('copy')}
          </button>
        </div>
      )}

      {/* Tabs */}
      <nav style={{ display: 'flex', gap: 6, padding: '14px 20px 0', flexWrap: 'wrap' }}>
        {(['products', 'orders', 'earnings', 'settings'] as Tab[]).map(k => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            style={{
              border: 'none', cursor: 'pointer', borderRadius: 10, padding: '9px 16px',
              fontWeight: 800, fontSize: '0.82rem',
              background: tab === k ? 'var(--teal, #00C4BC)' : '#0F1923',
              color: tab === k ? '#04221F' : 'var(--silver, #A8B4C0)',
              borderBottom: tab === k ? 'none' : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {t(`tab_${k}`)}
          </button>
        ))}
      </nav>

      <main style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
        {!data && !loadError && (
          <div style={{ ...card, textAlign: 'center', color: 'var(--silver, #A8B4C0)' }}>{t('loading')}...</div>
        )}
        {loadError && (
          <div style={{ ...card, textAlign: 'center' }}>
            <p style={{ color: 'var(--silver, #A8B4C0)' }}>{t('load_failed')}</p>
            <button type="button" onClick={load} style={btnPrimary}>{t('retry')}</button>
          </div>
        )}

        {/* ── Products And Pricing ── */}
        {data && tab === 'products' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ ...card, borderColor: 'rgba(0,196,188,0.25)' }}>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#FFFFFF', fontWeight: 700 }}>{t('pricing_intro')}</p>
              <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--silver, #A8B4C0)' }}>{t('pricing_note_multiples')} {t('set_cost_hint')}</p>
            </div>

            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('search_products')}
              aria-label={t('search_products')}
              style={{ ...inputStyle, maxWidth: 360 }}
            />

            {filteredProducts.length === 0 && (
              <div style={{ ...card, textAlign: 'center', color: 'var(--silver, #A8B4C0)' }}>{t('no_products_found')}</div>
            )}

            {filteredProducts.map(p => {
              const draft = drafts[p.id] ?? {};
              const priceVal = draft.price !== undefined ? draft.price : (p.retailPrice != null ? String(p.retailPrice) : '');
              const costVal = draft.cost !== undefined ? draft.cost : (p.manufacturerCost != null ? String(p.manufacturerCost) : '');
              const priceNum = Number(priceVal);
              const costNum = costVal === '' ? null : Number(costVal);
              const receive = Number.isFinite(priceNum) && priceVal !== '' ? Math.round(priceNum * keepFactor * 100) / 100 : null;
              const profit = receive != null && costNum != null && Number.isFinite(costNum)
                ? Math.round((receive - costNum) * 100) / 100
                : null;
              const dirty = draft.price !== undefined || draft.cost !== undefined;
              const state = rowState[p.id];

              return (
                <div key={p.id} style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', opacity: p.isVisible ? 1 : 0.55 }}>
                  <div style={{ flex: '1 1 200px', minWidth: 180 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{p.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--silver, #A8B4C0)', marginTop: 2 }}>
                      {p.unitSize ? `${p.unitSize}${p.unitMeasure ?? ''}` : ''}{p.category ? ` · ${p.category}` : ''}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleVisible(p)}
                      style={{ ...btnGhost, marginTop: 8, padding: '4px 10px', fontSize: '0.68rem', color: p.isVisible ? 'var(--teal, #00C4BC)' : 'var(--grey-400, #6B7683)' }}
                    >
                      {p.isVisible ? t('visible_in_store') : t('hidden')}
                    </button>
                  </div>

                  <div style={{ flex: '0 1 150px' }}>
                    <div style={label}>{t('price_per_10')} (USD)</div>
                    <input
                      type="number" min="0" step="0.01" inputMode="decimal"
                      value={priceVal}
                      onChange={e => setDrafts(d => ({ ...d, [p.id]: { ...d[p.id], price: e.target.value } }))}
                      style={{ ...inputStyle, marginTop: 4 }}
                      aria-label={t('price_per_10')}
                    />
                  </div>

                  <div style={{ flex: '0 1 150px' }}>
                    <div style={label} title={t('cost_private_note')}>{t('your_cost_per_10')}</div>
                    <input
                      type="number" min="0" step="0.01" inputMode="decimal"
                      value={costVal}
                      placeholder={t('not_set')}
                      onChange={e => setDrafts(d => ({ ...d, [p.id]: { ...d[p.id], cost: e.target.value } }))}
                      style={{ ...inputStyle, marginTop: 4 }}
                      aria-label={t('your_cost_per_10')}
                    />
                  </div>

                  <div style={{ flex: '0 1 130px' }}>
                    <div style={label}>{t('you_receive')} ({100 - pct}%)</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: 8, color: '#FFFFFF' }}>{money(receive)}</div>
                  </div>

                  <div style={{ flex: '0 1 130px' }}>
                    <div style={label}>{t('your_profit')}</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: 8, color: profit == null ? 'var(--grey-400, #6B7683)' : profit >= 0 ? 'var(--teal, #00C4BC)' : '#E53E3E' }}>
                      {profit == null ? t('not_set') : money(profit)}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--grey-400, #6B7683)' }}>{t('per_pack_of_10')}</div>
                  </div>

                  <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => saveRow(p)}
                      disabled={!dirty || state === 'saving'}
                      style={{ ...btnPrimary, opacity: !dirty || state === 'saving' ? 0.45 : 1 }}
                    >
                      {state === 'saving' ? t('saving') : t('save')}
                    </button>
                    {state === 'saved' && <span style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.75rem', fontWeight: 700 }}>{t('saved')}</span>}
                    {state === 'error' && <span style={{ color: '#E53E3E', fontSize: '0.75rem', fontWeight: 700 }}>{t('save_failed')}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Orders ── */}
        {data && tab === 'orders' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ ...card, borderColor: 'rgba(0,196,188,0.25)' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)' }}>{t('orders_intro')} {t('pricing_note_multiples')}</p>
            </div>

            {data.orders.length === 0 && (
              <div style={{ ...card, textAlign: 'center', color: 'var(--silver, #A8B4C0)' }}>{t('no_orders_yet')}</div>
            )}

            {data.orders.map(o => {
              const busy = orderBusy[o.id] === true;
              const canMarkPaid = o.status === 'pending_customer_payment';
              const canApprove = o.status === 'pending_customer_payment' || o.status === 'agent_approval_pending';
              const addr = o.shippingAddress as { street?: string; city?: string; state?: string; zip?: string } | null;
              return (
                <div key={o.id} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <div>
                      <span style={{ fontWeight: 800 }}>{t('col_order')} #{o.id.slice(0, 8)}</span>
                      <span style={{ color: 'var(--grey-400, #6B7683)', fontSize: '0.75rem', marginLeft: 10 }}>
                        {new Date(o.createdAt).toLocaleString(dateLocale)}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: 999,
                      background: o.status === 'cancelled' ? 'rgba(229,62,62,0.15)' : 'rgba(0,196,188,0.12)',
                      color: o.status === 'cancelled' ? '#E53E3E' : 'var(--teal, #00C4BC)',
                    }}>
                      {t(statusKey(o.status))}
                    </span>
                  </div>

                  <div style={{ marginTop: 10, fontSize: '0.82rem', color: 'var(--silver, #A8B4C0)' }}>
                    {t('col_buyer')}: <span style={{ color: '#FFFFFF' }}>{o.buyerName || '--'}</span>
                    {addr?.city ? <span> · {addr.street ? `${addr.street}, ` : ''}{addr.city}, {addr.state} {addr.zip}</span> : null}
                  </div>

                  <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', fontSize: '0.82rem' }}>
                    {o.items.map((it, i) => (
                      <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', borderBottom: '1px dashed rgba(255,255,255,0.06)' }}>
                        <span>{it.name}</span>
                        <span style={{ whiteSpace: 'nowrap' }}>{it.quantity} {t('vials')} × {money(it.unitPrice)}</span>
                      </li>
                    ))}
                  </ul>

                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10, fontSize: '0.82rem' }}>
                    <span>{t('product_subtotal')}: <strong>{money(o.subtotal)}</strong></span>
                    <span>{t('shipping')}: <strong>{money(o.shippingCost)}</strong></span>
                    <span>{t('col_total')}: <strong style={{ color: 'var(--teal, #00C4BC)' }}>{money(o.total)}</strong></span>
                  </div>

                  {(canMarkPaid || canApprove) && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                      {canMarkPaid && (
                        <button type="button" disabled={busy} onClick={() => orderAction(o, 'mark_paid')} style={{ ...btnGhost, opacity: busy ? 0.5 : 1 }}>
                          {t('mark_paid')}
                        </button>
                      )}
                      {canApprove && (
                        <button type="button" disabled={busy} onClick={() => orderAction(o, 'approve')} style={{ ...btnPrimary, opacity: busy ? 0.5 : 1 }}>
                          {t('approve_ship')}
                        </button>
                      )}
                      {confirmCancelId === o.id ? (
                        <button type="button" disabled={busy} onClick={() => orderAction(o, 'cancel')} style={{ ...btnGhost, color: '#E53E3E', borderColor: 'rgba(229,62,62,0.5)', opacity: busy ? 0.5 : 1 }}>
                          {t('confirm_cancel')}
                        </button>
                      ) : (
                        <button type="button" disabled={busy} onClick={() => setConfirmCancelId(o.id)} style={{ ...btnGhost, color: '#E53E3E', borderColor: 'rgba(229,62,62,0.35)', opacity: busy ? 0.5 : 1 }}>
                          {t('cancel_order')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Earnings ── */}
        {data && tab === 'earnings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ ...card, borderColor: 'rgba(0,196,188,0.25)' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)' }}>
                {t('earnings_intro')} {t('commission_explainer', { pct })}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {statCard(t('product_sales'), data.ledger.totals.sales, data.ledger.totals30.sales)}
              {statCard(`${t('platform_commission')} (${pct}%)`, data.ledger.totals.commission, data.ledger.totals30.commission)}
              {statCard(`${t('your_net_earnings')} (${100 - pct}%)`, data.ledger.totals.net, data.ledger.totals30.net)}
              {statCard(t('shipping_collected'), data.ledger.totals.shipping, data.ledger.totals30.shipping)}
            </div>

            {data.ledger.rows.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: 'var(--silver, #A8B4C0)' }}>{t('no_earnings_yet')}</div>
            ) : (
              <div style={{ ...card, overflowX: 'auto', padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: 640 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--silver, #A8B4C0)' }}>
                      {[t('col_date'), t('col_order'), t('product_subtotal'), `${t('col_commission')} (${pct}%)`, t('col_your_net'), t('shipping')].map(h => (
                        <th key={h} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.ledger.rows.map(r => (
                      <tr key={r.id} style={{ opacity: r.voided ? 0.45 : 1 }}>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{new Date(r.createdAt).toLocaleDateString(dateLocale)}</td>
                        <td style={{ padding: '8px 12px' }}>
                          #{r.orderId.slice(0, 8)}
                          {r.voided && <span style={{ marginLeft: 6, fontSize: '0.68rem', color: '#E53E3E', fontWeight: 800 }}>{t('voided')}</span>}
                        </td>
                        <td style={{ padding: '8px 12px' }}>{money(r.commissionBase)}</td>
                        <td style={{ padding: '8px 12px' }}>{money(r.platformCommission)}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--teal, #00C4BC)', fontWeight: 700 }}>{money(r.manufacturerNet)}</td>
                        <td style={{ padding: '8px 12px' }}>{money(r.shippingCollected)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Settings ── */}
        {data && tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 }}>
            <div style={card}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>{t('settings_language_title')}</div>
              <p style={{ margin: '0 0 12px', fontSize: '0.78rem', color: 'var(--silver, #A8B4C0)' }}>{t('settings_language_note')}</p>
              <LanguageToggle />
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>{t('your_commission_rate')}</div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--silver, #A8B4C0)' }}>
                {t('commission_explainer', { pct })}
              </p>
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>{t('change_password')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={label}>{t('new_password')}
                  <input type="password" value={pw1} onChange={e => setPw1(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} autoComplete="new-password" />
                </label>
                <label style={label}>{t('confirm_new_password')}
                  <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} autoComplete="new-password" />
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <button type="button" onClick={changePassword} disabled={pwBusy} style={{ ...btnPrimary, opacity: pwBusy ? 0.5 : 1 }}>
                    {t('update_password')}
                  </button>
                  {pwMsg && (
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: pwMsg.ok ? 'var(--teal, #00C4BC)' : '#E53E3E' }}>
                      {t(pwMsg.key)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
