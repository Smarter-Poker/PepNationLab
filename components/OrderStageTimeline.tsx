'use client';

/**
 * OrderStageTimeline (B3) - visual order tracking timeline.
 *
 * Maps the orders.status enum onto five human stages:
 *   Payment    -> pending_customer_payment
 *   Approval   -> agent_approval_pending (and admin_approval_pending)
 *   Preparing  -> approved_ship / approved_pickup / in_fulfillment
 *   Shipped    -> shipped (with tracking number + Track Package link)
 *   Delivered  -> delivered
 *
 * Cancelled renders a distinct terminal banner instead of the rail.
 * Pickup orders relabel the last two stages to Ready For Pickup / Picked Up.
 *
 * Horizontal on desktop, vertical on mobile (media query in the scoped
 * style block). Completed steps are teal with check icons, the current step
 * pulses, future steps are dim. Timestamps are only shown when the schema
 * actually stores them (created_at, shipped_at, delivered_at); updated_at
 * is used as a fallback on the current step only - nothing is invented.
 *
 * The Track Package link opens the carrier tracking page inside IframeModal
 * per the Omega Protocol - never a raw external navigation.
 *
 * Pure presentational client component: no fetching, the caller passes the
 * order row fields it already has.
 */

import React, { useState } from 'react';
import IframeModal from '@/components/ui/IframeModal';
import { carrierInfo } from '@/lib/carrier';

export interface OrderStageTimelineProps {
  status: string;
  fulfillmentMethod?: string | null;
  trackingNumber?: string | null;
  createdAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  updatedAt?: string | null;
}

const STATUS_STAGE: Record<string, number> = {
  pending_customer_payment: 0,
  agent_approval_pending: 1,
  admin_approval_pending: 1,
  approved_ship: 2,
  approved_pickup: 2,
  in_fulfillment: 2,
  shipped: 3,
  delivered: 4,
};

function fmtDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const STYLES = `
.pn-ost { display: flex; align-items: flex-start; width: 100%; }
.pn-ost-step { flex: 1; position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; min-width: 0; padding: 0 4px; }
.pn-ost-step::before { content: ''; position: absolute; top: 13px; right: calc(50% + 18px); left: calc(-50% + 18px); height: 3px; border-radius: 2px; background: rgba(255,255,255,0.08); }
.pn-ost-step:first-child::before { display: none; }
.pn-ost-step.pn-ost-reached::before { background: linear-gradient(90deg, #00C4BC 0%, #00E5FF 100%); box-shadow: 0 0 8px rgba(0,196,188,0.4); }
.pn-ost-dot { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); flex-shrink: 0; position: relative; z-index: 1; transition: all 0.3s ease; }
.pn-ost-step.pn-ost-done .pn-ost-dot { background: var(--teal, #00C4BC); border-color: var(--teal, #00C4BC); }
.pn-ost-step.pn-ost-current .pn-ost-dot { border-color: var(--teal, #00C4BC); background: rgba(0,196,188,0.15); animation: pnOstPulse 1.8s ease-out infinite; }
@keyframes pnOstPulse { 0% { box-shadow: 0 0 0 0 rgba(0,196,188,0.45); } 70% { box-shadow: 0 0 0 10px rgba(0,196,188,0); } 100% { box-shadow: 0 0 0 0 rgba(0,196,188,0); } }
.pn-ost-body { display: flex; flex-direction: column; align-items: center; margin-top: 8px; min-width: 0; }
.pn-ost-label { font-size: 0.72rem; font-weight: 600; color: rgba(255,255,255,0.35); letter-spacing: 0.03em; line-height: 1.3; }
.pn-ost-step.pn-ost-done .pn-ost-label, .pn-ost-step.pn-ost-current .pn-ost-label { color: var(--teal, #00C4BC); font-weight: 700; }
.pn-ost-time { margin-top: 3px; font-size: 0.68rem; color: var(--grey-500, #6B7A89); }
.pn-ost-extra { margin-top: 8px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.pn-ost-tn { font-size: 0.68rem; color: var(--silver, #A8B4C0); word-break: break-all; max-width: 170px; font-family: var(--font-brand, inherit); }
.pn-ost-track-btn { display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; border-radius: 999px; border: 1px solid rgba(0,196,188,0.45); background: rgba(0,196,188,0.12); color: var(--teal, #00C4BC); font-size: 0.74rem; font-weight: 700; letter-spacing: 0.02em; cursor: pointer; transition: background 0.2s ease; }
.pn-ost-track-btn:hover { background: rgba(0,196,188,0.22); }
.pn-ost-cancelled { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: var(--radius-md, 10px); background: rgba(229,62,62,0.06); border: 1px solid rgba(229,62,62,0.25); }
@media (max-width: 640px) {
  .pn-ost { flex-direction: column; }
  .pn-ost-step { flex-direction: row; align-items: flex-start; text-align: left; padding: 0 0 22px 0; width: 100%; }
  .pn-ost-step:last-child { padding-bottom: 0; }
  .pn-ost-step::before { display: none; }
  .pn-ost-step:not(:last-child)::after { content: ''; position: absolute; left: 13px; top: 32px; bottom: 4px; width: 3px; border-radius: 2px; background: rgba(255,255,255,0.08); }
  .pn-ost-step.pn-ost-line-done:not(:last-child)::after { background: linear-gradient(180deg, #00C4BC 0%, #00E5FF 100%); box-shadow: 0 0 8px rgba(0,196,188,0.4); }
  .pn-ost-body { align-items: flex-start; margin-top: 2px; margin-left: 12px; }
  .pn-ost-extra { align-items: flex-start; }
  .pn-ost-tn { max-width: none; }
}
`;

export default function OrderStageTimeline({
  status,
  fulfillmentMethod,
  trackingNumber,
  createdAt,
  shippedAt,
  deliveredAt,
  updatedAt,
}: OrderStageTimelineProps) {
  const [trackOpen, setTrackOpen] = useState(false);

  if (status === 'cancelled') {
    const cancelledStamp = fmtDate(updatedAt);
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />
        <div className="pn-ost-cancelled" role="status">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E53E3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>Order Cancelled</div>
            {cancelledStamp && (
              <div className="pn-ost-time" suppressHydrationWarning>Updated {cancelledStamp}</div>
            )}
          </div>
        </div>
      </>
    );
  }

  const isPickup = fulfillmentMethod === 'agent_pickup' || status === 'approved_pickup';
  const labels = [
    'Payment',
    'Approval',
    'Preparing',
    isPickup ? 'Ready For Pickup' : 'Shipped',
    isPickup ? 'Picked Up' : 'Delivered',
  ];

  const currentStage = STATUS_STAGE[status] ?? 0;
  const isTerminalDone = status === 'delivered';
  // Steps strictly before the current stage are complete; delivered completes all.
  const doneThrough = isTerminalDone ? 4 : currentStage - 1;

  // Real timestamps only: created_at on Payment, shipped_at on Shipped,
  // delivered_at on Delivered. updated_at fills the current step only when it
  // has no dedicated timestamp.
  const created = fmtDate(createdAt);
  const shipped = fmtDate(shippedAt);
  const delivered = fmtDate(deliveredAt);
  const stamps: Array<string | null> = [
    created ? `Placed ${created}` : null,
    null,
    null,
    shipped,
    delivered,
  ];
  const updated = fmtDate(updatedAt);
  if (!stamps[currentStage] && updated) {
    stamps[currentStage] = `Updated ${updated}`;
  }

  const { carrier, trackingUrl } = carrierInfo(trackingNumber);
  const showTracking = !isPickup && !!trackingNumber && currentStage >= 3;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div className="pn-ost" role="list" aria-label="Order Progress">
        {labels.map((label, i) => {
          const done = i <= doneThrough;
          const current = !isTerminalDone && i === currentStage;
          const classes = [
            'pn-ost-step',
            done ? 'pn-ost-done' : '',
            current ? 'pn-ost-current' : '',
            i <= currentStage ? 'pn-ost-reached' : '',
            i < currentStage || (isTerminalDone && i < 4) ? 'pn-ost-line-done' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div key={label} className={classes} role="listitem" aria-current={current ? 'step' : undefined}>
              <div className="pn-ost-dot" aria-hidden="true">
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#050A0F" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: current ? 'var(--teal, #00C4BC)' : 'transparent',
                    }}
                  />
                )}
              </div>
              <div className="pn-ost-body">
                <span className="pn-ost-label">{label}</span>
                {stamps[i] && (
                  <span className="pn-ost-time" suppressHydrationWarning>{stamps[i]}</span>
                )}
                {i === 3 && showTracking && (
                  <span className="pn-ost-extra">
                    <span className="pn-ost-tn">{trackingNumber}</span>
                    {trackingUrl && (
                      <button
                        type="button"
                        className="pn-ost-track-btn"
                        onClick={() => setTrackOpen(true)}
                      >
                        Track Package
                      </button>
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {trackOpen && trackingUrl && (
        <IframeModal
          url={trackingUrl}
          title={carrier !== 'Unknown' ? `Track With ${carrier}` : 'Track Package'}
          onClose={() => setTrackOpen(false)}
        />
      )}
    </>
  );
}
