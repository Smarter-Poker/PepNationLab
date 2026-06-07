'use client';

/**
 * ReorderOrderButton (R26)
 * --------------------------------------------------------------
 * Mounted next to ReceiptButton in the order-detail page. Promotes the
 * reorder-to-cart flow from /account/refills to the order itself so a
 * buyer who's looking at a finished order can re-buy it in one click.
 *
 * Behavior matches RefillsClient.reorder() exactly: POST to
 * /api/researcher/orders/[id]/reorder-cart, merge the returned items
 * into the per-storefront localStorage cart (additive), prune other
 * storefront carts to avoid cross-agent contamination, then redirect
 * to /checkout?agent=<slug>.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface ReorderItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  retailPrice: number;
  costPrice: number;
  weightOz: number;
  agentSelfBuy: boolean;
}

interface ReorderResponse {
  agentSlug?: string | null;
  items?: ReorderItem[];
  cartMap?: Record<string, number>;
  skipped?: Array<{ product_name: string; reason: string }>;
}

export default function ReorderStackButton({ orderId, bundleName }: { orderId: string, bundleName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/researcher/orders/${orderId}/reorder-cart`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ bundleName })
        },
      );
      const json: ReorderResponse & { error?: string } = await res
        .json()
        .catch(() => ({} as ReorderResponse));
      if (!res.ok) throw new Error(json?.error || 'Reorder Failed.');

      const agentSlug = json.agentSlug ?? null;
      const items = Array.isArray(json.items) ? json.items : [];
      const cartMap =
        json.cartMap && typeof json.cartMap === 'object' ? json.cartMap : {};
      const skipped = Array.isArray(json.skipped) ? json.skipped : [];

      if (items.length === 0) {
        throw new Error('No Items Available To Reorder.');
      }

      // Merge into per-agent cart additively. Identical algorithm to
      // RefillsClient - keep them in sync if either changes.
      const cartKey = agentSlug
        ? `pnl_storefront_cart_${agentSlug}`
        : 'pnl_storefront_cart';
      try {
        let existing: ReorderItem[] = [];
        const raw = localStorage.getItem(cartKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          existing = Array.isArray(parsed?.items)
            ? parsed.items
            : Array.isArray(parsed)
              ? parsed
              : [];
        }
        const byId = new Map<string, ReorderItem>(
          existing.map((i) => [`${i.id}-${i.bundleName || ''}`, { ...i }]),
        );
        for (const it of items) {
          const key = `${it.id}-${it.bundleName || ''}`;
          const ex = byId.get(key);
          if (ex) ex.quantity = (Number(ex.quantity) || 0) + it.quantity;
          else byId.set(key, it);
        }
        localStorage.setItem(
          cartKey,
          JSON.stringify({
            items: Array.from(byId.values()),
            _savedAt: Date.now(),
          }),
        );

        if (agentSlug && Object.keys(cartMap).length > 0) {
          let m: Record<string, number> = {};
          const rawMap = localStorage.getItem(`cart_${agentSlug}`);
          if (rawMap) {
            try {
              m = JSON.parse(rawMap) || {};
            } catch {
              m = {};
            }
          }
          for (const [apId, qty] of Object.entries(cartMap)) {
            m[apId] = (Number(m[apId]) || 0) + Number(qty);
          }
          localStorage.setItem(`cart_${agentSlug}`, JSON.stringify(m));
          localStorage.removeItem(`pnl_reorder_add_${agentSlug}`);
        }

        if (agentSlug) {
          Object.keys(localStorage)
            .filter(
              (k) =>
                k.startsWith('pnl_storefront_cart_') && k !== cartKey,
            )
            .forEach((k) => localStorage.removeItem(k));
        }
      } catch {
        /* localStorage unavailable - still redirect to checkout below */
      }

      if (skipped.length > 0) {
        const names = skipped
          .slice(0, 3)
          .map((s) => s.product_name)
          .join(', ');
        toast.warning(
          `Some Items Could Not Be Re-Added: ${names}${
            skipped.length > 3 ? '...' : ''
          }`,
        );
      } else {
        toast.success(`Stack '${bundleName}' Added To Cart.`);
      }

      const target = agentSlug
        ? `/checkout?agent=${encodeURIComponent(agentSlug)}`
        : '/checkout';
      router.push(target);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reorder Failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="btn btn-primary btn-sm"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: '0.78rem',
        padding: '6px 12px'
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      </svg>
      {busy ? 'Adding...' : 'Reorder Stack'}
    </button>
  );
}
