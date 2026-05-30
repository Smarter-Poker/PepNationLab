'use client';

import { useState } from 'react';
import { toast } from 'sonner';

type Method = 'zelle' | 'venmo' | 'cashapp' | 'apple_pay';

const OPTIONS: { id: Method; label: string; description: string }[] = [
  { id: 'zelle', label: 'Zelle', description: 'Bank-To-Bank Transfer. Common For Larger Orders.' },
  { id: 'venmo', label: 'Venmo', description: 'Fast Mobile Settlement. Most Popular.' },
  { id: 'cashapp', label: 'Cash App', description: 'Mobile Wallet Settlement.' },
  { id: 'apple_pay', label: 'Apple Pay', description: 'iPhone, iPad, And Mac Wallet.' },
];

export default function PaymentMethodClient({ initial }: { initial: Method | null }) {
  const [selected, setSelected] = useState<Method | null>(initial);
  const [busy, setBusy] = useState(false);

  async function save(next: Method | null) {
    setBusy(true);
    try {
      const res = await fetch('/api/account/payment-method', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_payment_method: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Save Failed');
      }
      setSelected(next);
      toast.success(next ? 'Default Payment Method Updated' : 'Default Payment Method Cleared');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {OPTIONS.map((opt) => {
        const active = selected === opt.id;
        return (
          <button
            key={opt.id}
            disabled={busy}
            onClick={() => save(opt.id)}
            className="card-glass"
            style={{
              textAlign: 'left',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: active ? '2px solid var(--teal)' : '1px solid rgba(255,255,255,0.08)',
              background: active ? 'rgba(0,196,188,0.06)' : 'var(--surface-2)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: 'var(--white)', fontWeight: 700, fontSize: '1rem' }}>{opt.label}</div>
                <div style={{ color: 'var(--silver)', fontSize: '0.85rem', marginTop: 4 }}>{opt.description}</div>
              </div>
              {active && (
                <span style={{ background: 'var(--teal)', color: 'var(--black)', fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>
                  Default
                </span>
              )}
            </div>
          </button>
        );
      })}
      {selected && (
        <button className="btn btn-ghost" disabled={busy} onClick={() => save(null)} style={{ alignSelf: 'flex-start', marginTop: 'var(--space-2)' }}>
          Clear Default
        </button>
      )}
    </div>
  );
}
