'use client';

import { useState } from 'react';
import { Bell, BellRing, Check } from 'lucide-react';
import GuestAuthModal from '@/components/GuestAuthModal';

// Drop-in "Notify Me" control for a product card or detail view. Self-contained:
// it only needs the product id (and optionally the storefront agent id for
// price-drop context). Posts to /api/researcher/product-alerts.
//
// Rendered by AgentStorefrontGrid on out-of-stock product cards; also safe to
// mount anywhere else a product is shown, e.g.
// <NotifyMeButton productId={p.id} agentId={agentId} />.

interface Props {
  productId: string;
  agentId?: string | null;
  mode?: 'back_in_stock' | 'price_drop';
  compact?: boolean;
}

export default function NotifyMeButton({ productId, agentId = null, mode = 'back_in_stock', compact = false }: Props) {
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  // --- SIGNUP CHECKPOINT: alert subscription ---
  // This is a commitment action (it stores a contact intent against an account),
  // so it is a legitimate place to ask -- unlike browsing or price display,
  // which stay open to guests.
  const [showGuestGate, setShowGuestGate] = useState(false);

  const label =
    state === 'done'
      ? 'We Will Notify You'
      : mode === 'price_drop'
        ? 'Notify Me Of A Price Drop'
        : 'Notify Me When Back In Stock';

  const subscribe = async () => {
    if (state === 'saving' || state === 'done') return;
    setState('saving');
    try {
      const res = await fetch('/api/researcher/product-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, agent_id: agentId, alert_type: mode }),
      });
      if (res.status === 401) {
        // Guest. This used to hard-navigate to /login, which threw away the
        // page they were on AND, for a QR-locked guest, was bounced straight
        // back to the storefront by the middleware -- so the tap did nothing
        // at all. Prompt in place instead and return them here after auth.
        setState('idle');
        setShowGuestGate(true);
        return;
      }
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  };

  return (
    <>
    <button
      type="button"
      onClick={subscribe}
      disabled={state === 'saving' || state === 'done'}
      aria-label={label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
        padding: compact ? '0.4rem 0.7rem' : '0.6rem 1rem',
        fontSize: compact ? '0.8rem' : '0.9rem', fontWeight: 600,
        background: state === 'done' ? 'rgba(72,187,120,0.14)' : '#162230',
        color: state === 'done' ? '#48BB78' : '#FFFFFF',
        border: `1px solid ${state === 'done' ? 'rgba(72,187,120,0.4)' : '#1D2D3E'}`,
        borderRadius: '10px',
        cursor: state === 'saving' || state === 'done' ? 'default' : 'pointer',
        opacity: state === 'saving' ? 0.7 : 1,
      }}
    >
      {state === 'done' ? <Check size={15} /> : state === 'saving' ? <BellRing size={15} /> : <Bell size={15} />}
      {state === 'error' ? 'Try Again' : label}
    </button>
    <GuestAuthModal
      open={showGuestGate}
      onClose={() => setShowGuestGate(false)}
      featureLabel="Stock Alerts"
      description={mode === 'price_drop'
        ? 'Create a free account and we will email you the moment this compound drops in price.'
        : 'Create a free account and we will email you the moment this compound is back in stock.'}
      ctaLabel="Create Free Account"
    />
    </>
  );
}
