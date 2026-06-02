'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RotateCcw, Clock, PackageCheck } from 'lucide-react';

interface OrderItem {
  id: string;
  product_id: string | null;
  product_name: string | null;
  quantity: number;
  unit_retail_price: number | null;
}

interface OrderRow {
  id: string;
  status: string | null;
  total: number | null;
  created_at: string;
  order_items: OrderItem[];
}

const REFILL_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;

const money = (n: number | null | undefined) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);

const fmtDate = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

function statusLabel(s: string | null): string {
  if (!s) return 'Pending';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function daysAgo(s: string): number {
  const t = new Date(s).getTime();
  if (isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / DAY_MS);
}

export default function RefillsClient() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reordering, setReordering] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/researcher/orders', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed');
        if (!cancelled) setOrders(Array.isArray(json.orders) ? json.orders : []);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const dueOrder = useMemo(() => {
    const latest = orders[0];
    if (!latest) return null;
    return daysAgo(latest.created_at) >= REFILL_DAYS ? latest : null;
  }, [orders]);

  async function reorder(orderId: string) {
    setReordering(orderId);
    try {
      // Resolve the past order's items against the CURRENT catalog/pricing. This
      // does NOT create an order. We drop the items into the storefront cart and
      // send the buyer straight to /checkout for a full-screen review.
      const res = await fetch(`/api/researcher/orders/${orderId}/reorder-cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Reorder Failed.');

      const agentSlug: string | null = json.agentSlug ?? null;
      const items: Array<{ id: string; name: string; sku: string; quantity: number; retailPrice: number; costPrice: number; weightOz: number; agentSelfBuy: boolean }> =
        Array.isArray(json.items) ? json.items : [];
      const cartMap: Record<string, number> = json.cartMap && typeof json.cartMap === 'object' ? json.cartMap : {};
      const skipped: Array<{ product_name: string; reason: string }> = json.skipped ?? [];

      if (items.length === 0) throw new Error('No Items Available To Reorder.');

      const canStash = !!agentSlug && Object.keys(cartMap).length > 0;

      // CRITICAL: a reorder must only ever ADD to the cart — it must NEVER replace
      // or empty whatever the buyer already has. So we do NOT overwrite the live cart
      // keys (cart_<slug> / pnl_storefront_cart_<slug>) here, where a stale read could
      // clobber the existing cart. Instead we stash the additions in a transient key.
      // The storefront grid, on mount, reads its existing cart as the source of truth
      // and ADDS this payload on top (see AgentStorefrontGrid mount-merge effect).
      try {
        if (canStash) {
          let pending: Record<string, number> = {};
          const rawPending = localStorage.getItem(`pnl_reorder_add_${agentSlug}`);
          if (rawPending) { try { pending = JSON.parse(rawPending) || {}; } catch { pending = {}; } }
          for (const [apId, qty] of Object.entries(cartMap)) {
            pending[apId] = (Number(pending[apId]) || 0) + Number(qty);
          }
          localStorage.setItem(`pnl_reorder_add_${agentSlug}`, JSON.stringify(pending));
        } else {
          // No storefront slug (or no resolvable storefront variants) — fall back to
          // the legacy checkout cart, still merging additively into anything present.
          const cartKey = 'pnl_storefront_cart';
          let existing: any[] = [];
          const raw = localStorage.getItem(cartKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            existing = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
          }
          const byId = new Map<string, any>(existing.map((i) => [i.id, { ...i }]));
          for (const it of items) {
            const ex = byId.get(it.id);
            if (ex) ex.quantity = (Number(ex.quantity) || 0) + it.quantity;
            else byId.set(it.id, it);
          }
          localStorage.setItem(cartKey, JSON.stringify({ items: Array.from(byId.values()), _savedAt: Date.now() }));
        }
      } catch { /* localStorage may be unavailable — fall through to redirect */ }

      if (skipped.length > 0) {
        toast.message('Some Items Were Not Available', {
          description: skipped.map((s) => `${s.product_name}: ${s.reason}`).join(', '),
        });
      }
      toast.success('Added To Cart. Review Your Order And Add More If You Like.');
      // Drop the buyer into the full-screen checkout view of their cart so they
      // immediately see the just-added items + anything they already had.
      router.push(agentSlug ? `/checkout?agent=${encodeURIComponent(agentSlug)}` : '/checkout');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reorder Failed.');
    } finally {
      setReordering(null);
    }
  }

  function itemSummary(o: OrderRow): string {
    const items = o.order_items ?? [];
    if (items.length === 0) return 'No Items';
    return items
      .map((it) => `${it.quantity}x ${it.product_name || 'Item'}`)
      .join(', ');
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)', padding: 'var(--space-6) var(--space-4)' }}>
      <div className="container" style={{ maxWidth: 760 }}>
        <h1
          className="animated-gradient-text"
          style={{ color: 'var(--white)', fontSize: '1.6rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-2)' }}
        >
          Order History And Reorders
        </h1>
        <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-6)' }}>
          Browse Your Past Orders. Tap Reorder To Add A Protocol Back To Your Cart — You’ll Drop Straight Into Checkout To Review, Edit, And Add More.
        </p>

        {dueOrder && (
          <div
            className="card-metal"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-4) var(--space-5)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid rgba(0,196,188,0.35)',
              marginBottom: 'var(--space-5)',
            }}
          >
            <Clock size={22} aria-hidden style={{ color: 'var(--teal)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'var(--white)', fontWeight: 700 }}>Time To Refill</div>
              <div style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>
                Your Last Order Was {daysAgo(dueOrder.created_at)} Days Ago.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={reordering === dueOrder.id}
              onClick={() => reorder(dueOrder.id)}
            >
              {reordering === dueOrder.id ? 'Adding...' : 'Reorder Now'}
            </button>
          </div>
        )}

        {loading ? (
          <p style={{ color: 'var(--silver)' }}>Loading Your Orders...</p>
        ) : error ? (
          <div className="card-metal" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)' }}>
            <p style={{ color: 'var(--white)', margin: 0 }}>Could Not Load Your Orders. Please Try Again.</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="card-metal" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
            <PackageCheck size={28} aria-hidden style={{ color: 'var(--teal)', marginBottom: 'var(--space-2)' }} />
            <div style={{ color: 'var(--white)', fontWeight: 700, marginBottom: 4 }}>No Past Orders Yet</div>
            <div style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>
              Once You Place An Order It Will Appear Here For Easy Reordering.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {orders.map((o) => {
              const due = daysAgo(o.created_at) >= REFILL_DAYS;
              return (
                <div
                  key={o.id}
                  className="card-metal"
                  style={{
                    padding: 'var(--space-4) var(--space-5)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--white)', fontWeight: 700 }}>{fmtDate(o.created_at)}</span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(168,180,192,0.14)',
                        color: 'var(--silver)',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {statusLabel(o.status)}
                    </span>
                    {due && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: 'rgba(0,196,188,0.14)',
                          color: 'var(--teal)',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Refill Due
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', color: 'var(--silver)', fontWeight: 700 }}>{money(o.total)}</span>
                  </div>
                  <div style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>{itemSummary(o)}</div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={reordering === o.id}
                      onClick={() => reorder(o.id)}
                    >
                      <RotateCcw size={14} aria-hidden style={{ marginRight: 6 }} />
                      {reordering === o.id ? 'Adding...' : 'Reorder'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
