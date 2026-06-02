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

// A research peptide protocol typically runs in cycles; the platform's refill
// drip nudges at ~21 days. We surface the same threshold here as a soft "due"
// signal so a researcher can reorder a finished protocol in one tap.
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

  // The single most-recent order is the refill candidate; if it is older than
  // the refill window we surface a prominent "Time To Refill" banner.
  const dueOrder = useMemo(() => {
    const latest = orders[0];
    if (!latest) return null;
    return daysAgo(latest.created_at) >= REFILL_DAYS ? latest : null;
  }, [orders]);

  async function reorder(orderId: string) {
    setReordering(orderId);
    try {
      // Resolve the past order's items against the CURRENT catalog/pricing — this
      // does NOT create an order. We then drop the items into the storefront cart
      // and send the buyer to checkout to review, edit, add more, and pay.
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

      const cartKey = agentSlug ? `pnl_storefront_cart_${agentSlug}` : 'pnl_storefront_cart';

      // Merge into any existing storefront cart for this agent (combine quantities).
      try {
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

        // Keep the storefront grid's own cart map in sync so "add more" shows these.
        if (agentSlug) {
          let m: Record<string, number> = {};
          const rawMap = localStorage.getItem(`cart_${agentSlug}`);
          if (rawMap) { try { m = JSON.parse(rawMap) || {}; } catch { m = {}; } }
          for (const [apId, qty] of Object.entries(cartMap)) m[apId] = (Number(m[apId]) || 0) + Number(qty);
          localStorage.setItem(`cart_${agentSlug}`, JSON.stringify(m));

          // Prevent cross-agent cart contamination (a buyer has one storefront).
          Object.keys(localStorage)
            .filter((k) => k.startsWith('pnl_storefront_cart_') && k !== cartKey)
            .forEach((k) => localStorage.removeItem(k));
        }
      } catch { /* localStorage may be unavailable — fall through to redirect */ }

      if (skipped.length > 0) {
        toast.message('Some Items Were Not Available', {
          description: skipped.map((s) => `${s.product_name}: ${s.reason}`).join(', '),
        });
      }
      toast.success('Added To Cart. Review And Check Out.');
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
          Refills & Reorders
        </h1>
        <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-6)' }}>
          Tap Reorder To Add A Past Protocol To Your Cart, Then Review, Edit, And Check Out. Prices Are Re-Checked Against The Current Catalog.
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
                          background: 'rgba(0,196,188,0.16)',
                          color: 'var(--teal)',
                          fontWeight: 700,
                        }}
                      >
                        Due For Refill
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', color: 'var(--teal)', fontWeight: 800 }}>{money(o.total)}</span>
                  </div>

                  <div style={{ color: 'var(--silver)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                    {itemSummary(o)}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-1)' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={reordering === o.id}
                      onClick={() => reorder(o.id)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                      <RotateCcw size={16} aria-hidden />
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
