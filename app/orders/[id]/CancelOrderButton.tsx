'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface CancelOrderButtonProps {
  orderId: string;
  currentStatus: string;
  viewerRole: 'admin' | 'agent'; // only admin/agent get this button
}

const NON_CANCELLABLE = new Set(['shipped', 'delivered', 'cancelled']);

export default function CancelOrderButton({
  orderId,
  currentStatus,
  viewerRole,
}: CancelOrderButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (NON_CANCELLABLE.has(currentStatus)) return null;

  const endpoint =
    viewerRole === 'admin'
      ? `/api/admin/orders/${orderId}/cancel`
      : `/api/agent/orders/cancel`;

  async function handleCancel() {
    if (!reason.trim()) {
      toast.error('Please enter a cancellation reason.');
      return;
    }
    setLoading(true);
    try {
      const body =
        viewerRole === 'admin'
          ? { reason }
          : { orderId, reason };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Failed to cancel order.');
        return;
      }
      toast.success('Order cancelled successfully.');
      setOpen(false);
      router.refresh();
    } catch {
      toast.error('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          borderRadius: 999,
          background: 'rgba(239,68,68,0.10)',
          border: '1px solid rgba(239,68,68,0.40)',
          color: '#EF4444',
          fontSize: '0.78rem',
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: '0.02em',
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        Cancel Order
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cancel Order"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.70)',
            backdropFilter: 'blur(4px)',
            padding: '0 16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            style={{
              background: 'var(--surface-1, #0d1520)',
              border: '1px solid rgba(239,68,68,0.30)',
              borderRadius: 14,
              padding: '28px 28px 24px',
              maxWidth: 460,
              width: '100%',
              boxShadow: '0 24px 64px rgba(0,0,0,0.60)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background: 'rgba(239,68,68,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                  Cancel This Order
                </h2>
                <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', margin: 0, marginTop: 2 }}>
                  Order #{orderId.slice(0, 8).toUpperCase()} · This cannot be undone.
                </p>
              </div>
            </div>

            {/* Reason input */}
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', color: 'var(--grey-400)', fontWeight: 600 }}>
              Cancellation Reason <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Customer requested cancellation, duplicate order, payment not received…"
              maxLength={500}
              rows={3}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: '0.88rem',
                color: '#fff',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                lineHeight: 1.5,
              }}
              autoFocus
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)', textAlign: 'right', marginTop: 3 }}>
              {reason.length}/500
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => { setOpen(false); setReason(''); }}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'var(--grey-300)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Keep Order
              </button>
              <button
                onClick={handleCancel}
                disabled={loading || !reason.trim()}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  borderRadius: 8,
                  background: loading ? 'rgba(239,68,68,0.20)' : 'rgba(239,68,68,0.85)',
                  border: '1px solid rgba(239,68,68,0.60)',
                  color: '#fff',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: loading || !reason.trim() ? 'not-allowed' : 'pointer',
                  opacity: !reason.trim() ? 0.5 : 1,
                }}
              >
                {loading ? 'Cancelling…' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
