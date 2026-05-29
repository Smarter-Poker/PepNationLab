'use client';

import { useState } from 'react';
import { toast } from 'sonner';

interface OrderItem {
  order_item_id: string;
  product_name: string;
  quantity: number;
  unit_retail_price: number;
}

interface Props {
  orderId: string;
  orderStatus: string;
  items: OrderItem[];
}

const ELIGIBLE_STATUSES = new Set([
  'shipped',
  'delivered',
  'approved_ship',
  'approved_pickup',
  'in_fulfillment',
]);

const REASON_OPTIONS = [
  { value: 'damaged', label: 'Damaged In Transit' },
  { value: 'wrong_item', label: 'Wrong Item Received' },
  { value: 'quality_issue', label: 'Quality Issue' },
  { value: 'not_as_described', label: 'Not As Described' },
  { value: 'other', label: 'Other' },
];

const RESOLUTION_OPTIONS = [
  { value: 'refund', label: 'Refund' },
  { value: 'store_credit', label: 'Store Credit' },
  { value: 'replacement', label: 'Replacement' },
];

const CONDITION_OPTIONS = [
  { value: 'unopened', label: 'Unopened' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'tampered', label: 'Tampered' },
  { value: 'partial', label: 'Partial' },
  { value: 'as_expected', label: 'As Expected' },
];

interface SelectionState {
  selected: boolean;
  quantity: number;
  condition: string;
}

export default function RequestReturnButton({ orderId, orderStatus, items }: Props) {
  const [open, setOpen] = useState(false);
  const [reasonCategory, setReasonCategory] = useState('damaged');
  const [reasonDetails, setReasonDetails] = useState('');
  const [resolution, setResolution] = useState<'refund' | 'store_credit' | 'replacement'>('refund');
  const [submitting, setSubmitting] = useState(false);
  const [selections, setSelections] = useState<Record<string, SelectionState>>(() => {
    const map: Record<string, SelectionState> = {};
    for (const it of items) {
      map[it.order_item_id] = { selected: false, quantity: it.quantity, condition: 'damaged' };
    }
    return map;
  });

  if (!ELIGIBLE_STATUSES.has(orderStatus)) return null;

  function updateSel(itemId: string, patch: Partial<SelectionState>) {
    setSelections((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  }

  async function submit() {
    const picked = items
      .filter((it) => selections[it.order_item_id]?.selected)
      .map((it) => ({
        order_item_id: it.order_item_id,
        quantity: Math.min(selections[it.order_item_id].quantity, it.quantity),
        unit_amount: it.unit_retail_price,
        condition_received: selections[it.order_item_id].condition,
      }));

    if (picked.length === 0) {
      toast.error('Select At Least One Item To Return');
      return;
    }
    if (reasonDetails.trim().length < 5) {
      toast.error('Please Provide A Brief Description Of The Issue (5+ Characters)');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/researcher/rma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          reason_category: reasonCategory,
          reason_details: reasonDetails.trim(),
          requested_resolution: resolution,
          items: picked,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request Failed');
      toast.success('Return Request Submitted');
      setOpen(false);
      // Redirect to the new RMA detail.
      window.location.href = `/account/rma/${data.id}`;
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        className="btn-secondary"
        type="button"
        onClick={() => setOpen(true)}
        style={{ fontSize: '0.85rem' }}
      >
        Request Return
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-3)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            className="card-metal"
            style={{
              maxWidth: 560,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: 'var(--space-5)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <h2 style={{ color: 'var(--white)', marginBottom: 'var(--space-3)' }}>Request A Return</h2>

            <label style={{ display: 'block', color: 'var(--silver)', fontSize: '0.85rem', marginBottom: 4 }}>Reason Category</label>
            <select
              className="input"
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              style={{ width: '100%', marginBottom: 'var(--space-3)' }}
            >
              {REASON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <label style={{ display: 'block', color: 'var(--silver)', fontSize: '0.85rem', marginBottom: 4 }}>Resolution Requested</label>
            <select
              className="input"
              value={resolution}
              onChange={(e) => setResolution(e.target.value as any)}
              style={{ width: '100%', marginBottom: 'var(--space-3)' }}
            >
              {RESOLUTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <label style={{ display: 'block', color: 'var(--silver)', fontSize: '0.85rem', marginBottom: 4 }}>What Happened?</label>
            <textarea
              className="input"
              value={reasonDetails}
              onChange={(e) => setReasonDetails(e.target.value)}
              rows={4}
              maxLength={2000}
              style={{ width: '100%', marginBottom: 'var(--space-3)', resize: 'vertical' }}
              placeholder="Briefly Describe The Problem..."
            />

            <div style={{ color: 'var(--white)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Items To Return</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              {items.map((it) => {
                const sel = selections[it.order_item_id];
                return (
                  <div
                    key={it.order_item_id}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--white)' }}>
                      <input
                        type="checkbox"
                        checked={sel?.selected || false}
                        onChange={(e) => updateSel(it.order_item_id, { selected: e.target.checked })}
                      />
                      <span style={{ flex: 1 }}>{it.product_name}</span>
                    </label>
                    {sel?.selected && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                        <div>
                          <label style={{ display: 'block', color: 'var(--silver)', fontSize: '0.78rem', marginBottom: 2 }}>Qty (Max {it.quantity})</label>
                          <input
                            type="number"
                            min={1}
                            max={it.quantity}
                            value={sel.quantity}
                            onChange={(e) => updateSel(it.order_item_id, { quantity: Math.max(1, Math.min(it.quantity, Number(e.target.value))) })}
                            className="input"
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', color: 'var(--silver)', fontSize: '0.78rem', marginBottom: 2 }}>Condition</label>
                          <select
                            value={sel.condition}
                            onChange={(e) => updateSel(it.order_item_id, { condition: e.target.value })}
                            className="input"
                            style={{ width: '100%' }}
                          >
                            {CONDITION_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
              <button className="btn-ghost" type="button" onClick={() => setOpen(false)} disabled={submitting}>
                Cancel
              </button>
              <button className="btn-primary" type="button" onClick={submit} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Return Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
