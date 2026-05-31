'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const PAYMENT_LABELS: Record<string, string> = {
  zelle: 'Zelle',
  cashapp: 'Cash App',
  venmo: 'Venmo',
  apple_pay: 'Apple Pay',
  paypal: 'PayPal',
  apple_cash: 'Apple Cash',
  google_wallet: 'Google Wallet',
  wise: 'Wise',
  chime: 'Chime',
};

interface Props {
  orderId: string;
  currentMethod: string;
  availableMethods: string[];
}

export default function ChangePaymentMethod({ orderId, currentMethod, availableMethods }: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState(currentMethod);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (selectedMethod === currentMethod) {
      setIsEditing(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/researcher/orders/update-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, paymentMethod: selectedMethod }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update payment method');

      toast.success('Payment method updated');
      setIsEditing(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update payment method');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="btn btn-secondary btn-sm"
        style={{ fontSize: '0.78rem', marginLeft: '12px' }}
      >
        Change Method
      </button>
    );
  }

  return (
    <div style={{ marginTop: '12px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--surface-3)' }}>
      <label className="form-label" style={{ marginBottom: '8px' }}>Select New Payment Method</label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <select
          className="form-input"
          value={selectedMethod}
          onChange={(e) => setSelectedMethod(e.target.value)}
          disabled={isSubmitting}
          style={{ width: '200px' }}
        >
          {availableMethods.map(method => (
            <option key={method} value={method}>
              {PAYMENT_LABELS[method] || method}
            </option>
          ))}
        </select>
        <button
          onClick={handleSubmit}
          className="btn btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => {
            setSelectedMethod(currentMethod);
            setIsEditing(false);
          }}
          className="btn btn-secondary"
          disabled={isSubmitting}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
