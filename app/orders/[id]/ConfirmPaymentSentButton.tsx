'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Buyer-side "I Sent Payment" confirmation for an order paid offline
 * (Zelle / CashApp / Venmo / etc). One tap stamps
 * orders.buyer_payment_sent_at via /api/researcher/orders/payment-sent,
 * stops the buyer's 12-hour confirmation reminders, and immediately asks the
 * agent "Did You Receive Payment?".
 *
 * Renders one of three states:
 *   - the confirm button (not yet confirmed)
 *   - "Payment Sent" + awaiting-agent note (buyer confirmed, agent not yet)
 *   - "Payment Received By Your Agent" (agent confirmed receipt)
 */
export default function ConfirmPaymentSentButton({
  orderId,
  buyerPaymentSentAt,
  paymentConfirmedAt,
}: {
  orderId: string;
  buyerPaymentSentAt: string | null;
  paymentConfirmedAt: string | null;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [localSentAt, setLocalSentAt] = useState<string | null>(buyerPaymentSentAt);
  const [error, setError] = useState('');

  const confirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/researcher/orders/payment-sent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Could Not Save Your Confirmation.');
      setLocalSentAt(data?.buyerPaymentSentAt || new Date().toISOString());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could Not Save Your Confirmation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (paymentConfirmedAt) {
    return (
      <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 'var(--space-3)', background: 'rgba(45,212,191,0.07)', border: '1px solid rgba(45,212,191,0.3)', borderRadius: 'var(--radius-md)' }}>
        <span style={{ color: '#2DD4BF', fontSize: '0.84rem', fontWeight: 700 }}>
          Payment Received By Your Agent ✓
        </span>
      </div>
    );
  }

  if (localSentAt) {
    return (
      <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-3)', background: 'rgba(45,212,191,0.07)', border: '1px solid rgba(45,212,191,0.3)', borderRadius: 'var(--radius-md)' }}>
        <span style={{ color: '#2DD4BF', fontSize: '0.84rem', fontWeight: 700 }}>
          Payment Sent ✓
        </span>
        <span style={{ color: 'var(--grey-400)', fontSize: '0.76rem' }}>
          Your Agent Will Confirm Receipt. You Will Be Notified When They Do.
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button
        type="button"
        onClick={confirm}
        disabled={submitting}
        className="btn btn-primary"
        style={{ fontSize: '0.9rem', fontWeight: 700, padding: '11px 20px', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}
      >
        {submitting ? 'Saving...' : 'I Sent Payment'}
      </button>
      <span style={{ color: 'var(--grey-500)', fontSize: '0.74rem' }}>
        Tap After You Have Sent Payment So Your Agent Can Confirm And Process The Order.
      </span>
      {error && <span style={{ color: '#ff6b6b', fontSize: '0.76rem' }}>{error}</span>}
    </div>
  );
}
