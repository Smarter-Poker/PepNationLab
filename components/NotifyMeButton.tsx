'use client';

import { useState } from 'react';
import { Bell, BellRing, Check } from 'lucide-react';

// Drop-in "Notify Me" control for a product card or detail view. Self-contained:
// it only needs the product id (and optionally the storefront agent id for
// price-drop context). Posts to /api/researcher/product-alerts.
//
// Not yet wired into AgentStorefrontGrid to avoid editing that hot file while a
// concurrent refactor is in flight; import and render it wherever a product is
// shown out of stock, e.g. <NotifyMeButton productId={p.id} agentId={agentId} />.

interface Props {
  productId: string;
  agentId?: string | null;
  mode?: 'back_in_stock' | 'price_drop';
  compact?: boolean;
}

export default function NotifyMeButton({ productId, agentId = null, mode = 'back_in_stock', compact = false }: Props) {
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

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
        // Guest -- send them to sign in, preserving intent is a future nicety.
        window.location.href = '/login';
        return;
      }
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  };

  return (
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
  );
}
