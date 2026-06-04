'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import type { CartWarning } from '@/lib/compounds';

interface CartWarningsProps {
  slugs?: string[];
  productIds?: string[];
}

const LEVEL_STYLE: Record<
  CartWarning['level'],
  { color: string; bg: string; border: string }
> = {
  danger: { color: '#FF6B6B', bg: 'rgba(229,62,62,0.12)', border: 'rgba(229,62,62,0.4)' },
  warning: { color: '#F6AD55', bg: 'rgba(246,173,85,0.12)', border: 'rgba(246,173,85,0.4)' },
  info: { color: '#00C4BC', bg: 'rgba(0,196,188,0.10)', border: 'rgba(0,196,188,0.4)' },
};

function LevelIcon({ level }: { level: CartWarning['level'] }) {
  if (level === 'danger') return <ShieldAlert size={18} aria-hidden="true" />;
  if (level === 'warning') return <AlertTriangle size={18} aria-hidden="true" />;
  return <Info size={18} aria-hidden="true" />;
}

export default function CartWarnings({ slugs, productIds }: CartWarningsProps) {
  const [warnings, setWarnings] = useState<CartWarning[]>([]);

  const slugKey = (slugs ?? []).join(',');
  const productKey = (productIds ?? []).join(',');

  useEffect(() => {
    let cancelled = false;
    const uniqueSlugs = slugKey ? Array.from(new Set(slugKey.split(','))).filter(Boolean) : [];
    const uniqueProductIds = productKey ? Array.from(new Set(productKey.split(','))).filter(Boolean) : [];
    if (uniqueSlugs.length === 0 && uniqueProductIds.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWarnings([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/research/cart-warnings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slugs: uniqueSlugs, productIds: uniqueProductIds }),
        });
        const data = (await res.json()) as { warnings?: CartWarning[] };
        if (!cancelled) setWarnings(data.warnings ?? []);
      } catch {
        if (!cancelled) setWarnings([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Depend only on the stable joined-string keys; the raw arrays are new
    // references each render (e.g. cart.map(...) inline) and would loop.
  }, [slugKey, productKey]);

  if (warnings.length === 0) return null;

  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)', margin: 'var(--space-4) 0' }}>
      {warnings.map((w, i) => {
        const s = LEVEL_STYLE[w.level];
        return (
          <div
            key={`${w.title}-${i}`}
            role="note"
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              background: s.bg,
              border: `1px solid ${s.border}`,
            }}
          >
            <div style={{ color: s.color, flexShrink: 0, marginTop: '0.1rem' }}>
              <LevelIcon level={w.level} />
            </div>
            <div>
              <p style={{ margin: 0, color: s.color, fontWeight: 700 }}>{w.title}</p>
              <p style={{ margin: '0.35rem 0 0', color: '#D0DAE4', fontSize: '0.9rem', lineHeight: 1.5 }}>
                {w.detail}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
