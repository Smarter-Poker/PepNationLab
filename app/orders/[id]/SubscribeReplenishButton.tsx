'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface OrderItem {
  agent_product_id: string | null;
  quantity: number;
}

interface ShippingAddress {
  fullName?: string;
  street?: string;
  suite?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface Props {
  agentId: string | null;
  paymentMethod: string;
  fulfillmentMethod: string | null;
  shippingAddress: ShippingAddress | null;
  items: OrderItem[];
}

const CADENCE_OPTIONS = [7, 14, 30, 60, 90];

export default function SubscribeReplenishButton({
  agentId,
  paymentMethod,
  fulfillmentMethod,
  shippingAddress,
  items,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cadence, setCadence] = useState<number>(30);
  const [submitting, setSubmitting] = useState(false);

  // Filter to items that have a valid agent_product_id (the only ones that can
  // be re-resolved on the next run).
  const eligible = items
    .filter((i) => i.agent_product_id && Number(i.quantity) > 0)
    .map((i) => ({ agent_product_id: String(i.agent_product_id), quantity: Number(i.quantity) }));

  if (!agentId || eligible.length === 0) {
    return null;
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const body = {
        agent_id: agentId,
        cadence_days: cadence,
        payment_method: paymentMethod,
        fulfillment_method: fulfillmentMethod ?? 'ship',
        shipping_address: fulfillmentMethod === 'ship' ? shippingAddress : null,
        items: eligible,
      };
      const res = await fetch('/api/researcher/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error ?? 'Failed To Create Subscription');
        return;
      }
      toast.success('Subscription Created');
      setOpen(false);
      router.push('/account/subscriptions');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-secondary"
        style={{ fontSize: '0.85rem' }}
      >
        Set Up Auto-Replenish
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="glass-panel" style={{ padding: 'var(--space-6)', maxWidth: 460, width: '100%' }}>
            <h2 style={{ fontSize: '1.1rem', color: 'var(--white)', marginBottom: 'var(--space-2)' }}>
              Auto-Replenish This Order
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4)' }}>
              We Will Recreate This Order Automatically On Your Schedule. You Pay Each Run As Usual.
            </p>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="cadence-pick" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--silver)', marginBottom: 'var(--space-2)' }}>
                Cadence
              </label>
              <div id="cadence-pick" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {CADENCE_OPTIONS.map((d) => {
                  const active = cadence === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setCadence(d)}
                      className={active ? 'btn btn-primary' : 'btn btn-secondary'}
                      style={{ fontSize: '0.82rem' }}
                    >
                      Every {d} Days
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: 'var(--border-subtle)' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--grey-500)', textTransform: 'uppercase', marginBottom: 4 }}>Will Re-Order</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--silver)' }}>
                {eligible.length} Item{eligible.length === 1 ? '' : 's'} ·{' '}
                {fulfillmentMethod === 'ship' ? 'Shipped To Your Saved Address' : 'Agent Pickup'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary" disabled={submitting}>
                Cancel
              </button>
              <button type="button" onClick={submit} className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : 'Create Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
