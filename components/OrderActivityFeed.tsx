'use client';

/**
 * OrderActivityFeed - buyer-facing order activity history.
 *
 * Renders the authoritative per-order timeline from public.order_events as a
 * vertical feed: Order Placed, Payment Confirmed, Approved, Reminders,
 * Shipped, Delivered, Cancelled. Internal operational events (staleness
 * escalations, admin-review demotions) are filtered out - buyers only see
 * events about THEIR order journey.
 *
 * Pure presentational client component: no fetching, no state. Rendered on
 * the client so event timestamps display in the buyer's own timezone. The
 * caller (app/orders/[id]/page.tsx) passes rows it already read under RLS. Renders nothing when no visible events exist, so it is always
 * safe to mount.
 */

import React from 'react';

export interface OrderActivityEvent {
  event: string;
  actor_role: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface EventDef {
  label: string;
  color: string;
  detail?: (payload: Record<string, unknown> | null) => string | null;
}

const money = (v: unknown): string | null => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Buyer-visible events only; anything not listed here is hidden. */
const EVENT_DEFS: Record<string, EventDef> = {
  placed: {
    label: 'Order Placed',
    color: 'var(--teal)',
    detail: (p) => {
      const total = money(p?.total);
      return total ? `Order Total ${total}` : null;
    },
  },
  auto_approved: {
    label: 'Order Approved Automatically',
    color: '#48BB78',
  },
  payment_confirmed: {
    label: 'Payment Confirmed',
    color: '#48BB78',
    detail: (p) => {
      const total = money(p?.total);
      return total ? `Payment Of ${total} Verified By Your Seller` : 'Payment Verified By Your Seller';
    },
  },
  approved: {
    label: 'Order Approved',
    color: '#48BB78',
    detail: (p) => (p?.status === 'approved_pickup' ? 'Ready To Prepare For Pickup' : 'Being Prepared For Shipment'),
  },
  forwarded_to_super: {
    label: 'Approval In Progress',
    color: '#F6AD55',
    detail: () => 'Your Order Was Sent Up For Final Approval',
  },
  payment_reminder_sent: {
    label: 'Payment Reminder Sent',
    color: '#F6AD55',
  },
  shipped: {
    label: 'Order Shipped',
    color: '#63B3ED',
    detail: (p) => {
      const trk = typeof p?.tracking_number === 'string' && p.tracking_number ? String(p.tracking_number) : null;
      return trk ? `Tracking: ${trk}` : null;
    },
  },
  delivered: {
    label: 'Order Delivered',
    color: '#9F7AEA',
  },
  cancelled: {
    label: 'Order Cancelled',
    color: '#F56565',
    detail: (p) => (typeof p?.reason === 'string' && p.reason ? String(p.reason) : null),
  },
  status_changed: {
    label: 'Order Status Updated',
    color: 'var(--grey-400)',
    detail: (p) => {
      const to = typeof p?.to === 'string' ? p.to : null;
      return to ? `Now ${to.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}` : null;
    },
  },
};

export default function OrderActivityFeed({ events }: { events: OrderActivityEvent[] }) {
  const visible = (events || []).filter((e) => EVENT_DEFS[e.event]);
  if (visible.length === 0) return null;

  return (
    <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-6)', animationDelay: '0.5s' }}>
      <h2 style={{ fontSize: '0.95rem', color: 'var(--silver)', marginBottom: 'var(--space-2)' }}>
        Order Activity
      </h2>
      <p style={{ fontSize: '0.78rem', color: 'var(--grey-500)', marginBottom: 'var(--space-4)' }}>
        A Complete History Of Everything That Has Happened With This Order.
      </p>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, position: 'relative' }}>
        {visible.map((e, idx) => {
          const def = EVENT_DEFS[e.event];
          const detail = def.detail ? def.detail(e.payload ?? null) : null;
          const isLast = idx === visible.length - 1;
          return (
            <li
              key={`${e.event}-${e.created_at}-${idx}`}
              style={{ display: 'flex', gap: 'var(--space-3)', position: 'relative', paddingBottom: isLast ? 0 : 'var(--space-4)' }}
            >
              {/* Rail + dot */}
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 14 }} aria-hidden="true">
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: def.color,
                    boxShadow: `0 0 8px ${def.color}`,
                    marginTop: 4,
                    flexShrink: 0,
                  }}
                />
                {!isLast && (
                  <span style={{ flex: 1, width: 2, background: 'rgba(255,255,255,0.08)', marginTop: 4 }} />
                )}
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--white)', fontWeight: 600, margin: 0 }}>
                  {def.label}
                </p>
                {detail && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', margin: '2px 0 0', lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                    {detail}
                  </p>
                )}
                <p style={{ fontSize: '0.72rem', color: 'var(--grey-500)', margin: '2px 0 0' }}>
                  {new Date(e.created_at).toLocaleString()}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
