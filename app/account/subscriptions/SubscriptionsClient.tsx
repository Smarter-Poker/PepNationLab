'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

interface AgentInfo {
  display_name: string | null;
  slug: string | null;
}

interface SnapshotItem {
  agent_product_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_retail_price: number | string;
}

interface Subscription {
  id: string;
  agent_id: string;
  status: 'active' | 'paused' | 'cancelled';
  cadence_days: number;
  payment_method: string;
  fulfillment_method: string;
  shipping_address: Record<string, string | null> | null;
  items_snapshot: SnapshotItem[];
  next_run_at: string;
  last_run_at: string | null;
  last_order_id: string | null;
  failure_count: number;
  last_failure_reason: string | null;
  paused_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  agent: AgentInfo;
}

const STATUS_COLORS: Record<string, string> = {
  active: '#68D391',
  paused: '#F6AD55',
  cancelled: 'var(--grey-400)',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  cancelled: 'Cancelled',
};

const PAYMENT_LABELS: Record<string, string> = {
  zelle: 'Zelle',
  cashapp: 'Cash App',
  venmo: 'Venmo',
  apple_pay: 'Apple Pay',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '—';
  }
}

function formatMoney(n: number | string): string {
  return `$${Number(n ?? 0).toFixed(2)}`;
}

export default function SubscriptionsClient({ initialSubscriptions }: { initialSubscriptions: Subscription[] }) {
  const [subs, setSubs] = useState<Subscription[]>(initialSubscriptions);
  const [editing, setEditing] = useState<Subscription | null>(null);

  async function callPatch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/researcher/subscriptions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json?.error ?? 'Update Failed');
      return null;
    }
    return json?.subscription ?? null;
  }

  async function setStatus(sub: Subscription, status: 'active' | 'paused' | 'cancelled') {
    const updated = await callPatch(sub.id, { status });
    if (updated) {
      setSubs((prev) => prev.map((s) => (s.id === sub.id ? { ...s, ...updated } : s)));
      toast.success(status === 'cancelled' ? 'Subscription Cancelled' : status === 'paused' ? 'Subscription Paused' : 'Subscription Resumed');
    }
  }

  async function saveEdit(updated: { cadence_days: number; payment_method: string }) {
    if (!editing) return;
    const saved = await callPatch(editing.id, updated);
    if (saved) {
      setSubs((prev) => prev.map((s) => (s.id === editing.id ? { ...s, ...saved } : s)));
      toast.success('Subscription Updated');
      setEditing(null);
    }
  }

  if (subs.length === 0) {
    return (
      <div className="card-metal" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--silver)', fontSize: '1.1rem', marginBottom: 'var(--space-3)' }}>
          You Have No Auto-Replenish Subscriptions
        </h2>
        <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem', marginBottom: 'var(--space-4)' }}>
          After Placing An Order You Can Set Up A Recurring Replenishment From The Order Detail Page.
        </p>
        <Link href="/orders" className="btn btn-primary" style={{ display: 'inline-flex' }}>
          View My Orders
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {subs.map((sub) => {
        const color = STATUS_COLORS[sub.status] ?? 'var(--grey-400)';
        const itemCount = Array.isArray(sub.items_snapshot) ? sub.items_snapshot.length : 0;
        // unit_retail_price is stored as per-10-vial-pack price; divide by 10 for per-vial.
        const total = (Array.isArray(sub.items_snapshot) ? sub.items_snapshot : [])
          .reduce((sum, it) => sum + (Number(it.unit_retail_price ?? 0) / 10) * Number(it.quantity ?? 0), 0);
        return (
          <div key={sub.id} className="card-metal" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <div>
                <div style={{ fontSize: '1rem', color: 'var(--white)', fontWeight: 700, marginBottom: 4 }}>
                  Subscription #{sub.id.slice(0, 8).toUpperCase()}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)' }}>
                  Agent: <span style={{ color: 'var(--teal)' }}>{sub.agent.display_name ?? 'Unknown'}</span>
                  {sub.agent.slug ? ` · /${sub.agent.slug}` : ''}
                </div>
              </div>
              <span style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                color,
                background: `${color}18`,
                border: `1px solid ${color}40`,
                padding: '4px var(--space-3)',
                borderRadius: 'var(--radius-full)',
              }}>
                {STATUS_LABELS[sub.status] ?? sub.status}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--grey-500)', textTransform: 'uppercase', marginBottom: 2 }}>Cadence</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--silver)' }}>Every {sub.cadence_days} Days</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--grey-500)', textTransform: 'uppercase', marginBottom: 2 }}>Next Run</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--silver)' }}>{formatDate(sub.next_run_at)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--grey-500)', textTransform: 'uppercase', marginBottom: 2 }}>Payment</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--silver)' }}>{PAYMENT_LABELS[sub.payment_method] ?? sub.payment_method}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--grey-500)', textTransform: 'uppercase', marginBottom: 2 }}>Items</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--silver)' }}>{itemCount} · {formatMoney(total)}</div>
              </div>
            </div>

            {sub.last_failure_reason && (
              <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-3)', background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.25)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--red)', textTransform: 'uppercase', marginBottom: 2 }}>Last Failure</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--silver)' }}>{sub.last_failure_reason}</div>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <Link href={`/account/subscriptions/${sub.id}`} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>
                View Details
              </Link>
              {sub.status === 'active' && (
                <button type="button" onClick={() => setStatus(sub, 'paused')} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>
                  Pause
                </button>
              )}
              {sub.status === 'paused' && (
                <button type="button" onClick={() => setStatus(sub, 'active')} className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
                  Resume
                </button>
              )}
              {sub.status !== 'cancelled' && (
                <>
                  <button type="button" onClick={() => setEditing(sub)} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>
                    Edit Schedule
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Cancel This Subscription? This Cannot Be Undone.')) {
                        setStatus(sub, 'cancelled');
                      }
                    }}
                    className="btn btn-danger"
                    style={{ fontSize: '0.82rem' }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}

      {editing && (
        <EditModal
          subscription={editing}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}
    </div>
  );
}

interface EditModalProps {
  subscription: Subscription;
  onClose: () => void;
  onSave: (body: { cadence_days: number; payment_method: string }) => void;
}

function EditModal({ subscription, onClose, onSave }: EditModalProps) {
  const [cadence, setCadence] = useState<number>(subscription.cadence_days);
  const [payment, setPayment] = useState<string>(subscription.payment_method);

  const options = useMemo(() => [7, 14, 21, 30, 45, 60, 90, 120, 180, 365], []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card-metal" style={{ padding: 'var(--space-6)', maxWidth: 460, width: '100%' }}>
        <h2 style={{ fontSize: '1.1rem', color: 'var(--white)', marginBottom: 'var(--space-3)' }}>
          Edit Subscription Schedule
        </h2>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="sub-cadence" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--silver)', marginBottom: 6 }}>
            Cadence (Days)
          </label>
          <select
            id="sub-cadence"
            value={cadence}
            onChange={(e) => setCadence(Number(e.target.value))}
            style={{ width: '100%', padding: 'var(--space-2) var(--space-3)', background: 'var(--surface-2)', color: 'var(--white)', border: 'var(--border-subtle)', borderRadius: 'var(--radius-md)' }}
          >
            {options.map((d) => (
              <option key={d} value={d}>Every {d} Days</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="sub-payment" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--silver)', marginBottom: 6 }}>
            Payment Method
          </label>
          <select
            id="sub-payment"
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
            style={{ width: '100%', padding: 'var(--space-2) var(--space-3)', background: 'var(--surface-2)', color: 'var(--white)', border: 'var(--border-subtle)', borderRadius: 'var(--radius-md)' }}
          >
            <option value="zelle">Zelle</option>
            <option value="cashapp">Cash App</option>
            <option value="venmo">Venmo</option>
            <option value="apple_pay">Apple Pay</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button type="button" onClick={() => onSave({ cadence_days: cadence, payment_method: payment })} className="btn btn-primary">Save</button>
        </div>
      </div>
    </div>
  );
}
