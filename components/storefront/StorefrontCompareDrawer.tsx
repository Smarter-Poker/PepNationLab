'use client';

/**
 * R35 Phase 3 — Compare drawer for agent storefronts.
 *
 * Fixed, bottom-anchored drawer that lets a researcher pin up to 3 products
 * from the modal's "Pin To Compare" button and view them side by side.
 *
 * Self-contained:
 *   - State lives in localStorage under the key `pnl:compare`.
 *   - Adds happen via the custom DOM event `pnl:compare-add` dispatched by
 *     ProductModalEnhancements -> PinToCompareButton.
 *   - Renders into document.body via createPortal so it can be mounted from
 *     anywhere in the tree without affecting layout flow.
 *   - When zero items pinned, renders nothing.
 *
 * Caller: components/AgentStorefrontGrid.tsx (one-line mount, no props beyond
 * primaryColor).
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { evidenceTier } from '@/lib/compounds';

interface PinnedItem {
  productName: string;
  imageUrl: string | null;
  pricePerVialDollars: number | null;
  compoundSlug: string | null;
  evidenceTierKey: string | null;
  pinnedAt: number;
}

const STORAGE_KEY = 'pnl:compare';
const MAX_PINNED = 3;

function readPinned(): PinnedItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) || '[]';
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.slice(-MAX_PINNED);
  } catch {
    return [];
  }
}

function writePinned(list: PinnedItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_PINNED)));
  } catch {
    // localStorage may be unavailable; ignore.
  }
}

function dispatchAddAllToCart(items: PinnedItem[]) {
  if (typeof window === 'undefined') return;
  // Phase 4: Stack Builder — emit a single event the storefront grid listens
  // for (via existing pnl:add-to-cart-by-name handler in AgentStorefrontGrid).
  // The handler resolves each name to a product variant and adds 1 vial each.
  for (const item of items) {
    try {
      window.dispatchEvent(new CustomEvent('pnl:add-to-cart-by-name', {
        detail: { name: item.productName },
      }));
    } catch {
      // ignore
    }
  }
}

export default function StorefrontCompareDrawer({ primaryColor }: { primaryColor: string }) {
  const [pinned, setPinned] = useState<PinnedItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setMounted(true);
    setPinned(readPinned());

    const onAdd = (e: Event) => {
      const detail = (e as CustomEvent<PinnedItem>).detail;
      if (!detail || !detail.productName) return;
      setPinned((prev) => {
        const filtered = prev.filter((p) => p.productName !== detail.productName);
        const next = [...filtered, detail].slice(-MAX_PINNED);
        writePinned(next);
        return next;
      });
      setCollapsed(false);
    };

    const onRemove = (e: Event) => {
      const detail = (e as CustomEvent<{ productName: string }>).detail;
      if (!detail || !detail.productName) return;
      setPinned((prev) => {
        const next = prev.filter((p) => p.productName !== detail.productName);
        writePinned(next);
        return next;
      });
    };

    const onClear = () => {
      setPinned([]);
      writePinned([]);
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPinned(readPinned());
    };

    window.addEventListener('pnl:compare-add', onAdd as EventListener);
    window.addEventListener('pnl:compare-remove', onRemove as EventListener);
    window.addEventListener('pnl:compare-clear', onClear as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('pnl:compare-add', onAdd as EventListener);
      window.removeEventListener('pnl:compare-remove', onRemove as EventListener);
      window.removeEventListener('pnl:compare-clear', onClear as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  function removeAt(i: number) {
    setPinned((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      writePinned(next);
      return next;
    });
  }

  function clearAll() {
    setPinned([]);
    writePinned([]);
  }

  if (!mounted) return null;
  if (pinned.length === 0) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="region"
      aria-label="Compare Pinned Products"
      style={{
        position: 'fixed',
        left: 0, right: 0,
        bottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 99000,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          margin: '0 auto',
          maxWidth: 980,
          pointerEvents: 'auto',
          background: 'linear-gradient(180deg, #131b24 0%, #0a0f14 100%)',
          border: `2px solid ${primaryColor}55`,
          borderBottom: 'none',
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 -10px 32px rgba(0,0,0,0.55)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: `linear-gradient(90deg, ${primaryColor}25, transparent)`,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            color: primaryColor, fontWeight: 800, fontSize: '0.86rem',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            flex: 1,
          }}>
            Compare ({pinned.length} Of {MAX_PINNED})
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'var(--white)', borderRadius: 8, padding: '6px 12px',
              fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
          <button
            type="button"
            onClick={() => dispatchAddAllToCart(pinned)}
            aria-label="Add All Pinned To Cart - Stack Builder"
            style={{
              background: primaryColor, border: `1px solid ${primaryColor}`,
              color: '#04221F', borderRadius: 8, padding: '6px 12px',
              fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer',
              boxShadow: `0 2px 8px ${primaryColor}55`,
            }}
          >
            Add All To Cart
          </button>
          <button
            type="button"
            onClick={clearAll}
            aria-label="Clear All Pinned"
            style={{
              background: 'rgba(229,62,62,0.10)', border: '1px solid rgba(229,62,62,0.32)',
              color: '#F08A8A', borderRadius: 8, padding: '6px 12px',
              fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Clear All
          </button>
        </div>

        {!collapsed && (
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: `repeat(${pinned.length}, 1fr)`, gap: 10 }}>
            {pinned.map((item, i) => {
              const tier = item.evidenceTierKey ? evidenceTier(item.evidenceTierKey) : null;
              return (
                <div
                  key={item.productName}
                  style={{
                    position: 'relative',
                    padding: 10, borderRadius: 12,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    display: 'flex', flexDirection: 'column', gap: 8,
                    minHeight: 130,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    aria-label={`Remove ${item.productName} From Compare`}
                    style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 24, height: 24, minWidth: 24, minHeight: 24,
                      borderRadius: '50%', padding: 0,
                      background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.18)',
                      color: 'var(--white)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        width={36}
                        height={36}
                        style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', background: '#0F1923' }}
                      />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${primaryColor}25` }} aria-hidden="true" />
                    )}
                    <div style={{
                      flex: 1, color: 'var(--white)', fontWeight: 800,
                      fontSize: '0.82rem', lineHeight: 1.2, paddingRight: 22,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {item.productName}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {tier && (
                      <span style={{
                        fontSize: '0.64rem', padding: '3px 8px', borderRadius: 9999,
                        background: `${tier.color}1A`, color: tier.color, fontWeight: 800,
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        border: `1px solid ${tier.color}55`,
                      }}>{tier.label}</span>
                    )}
                    {item.pricePerVialDollars != null && (
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: primaryColor, fontFamily: 'var(--font-brand)' }}>
                        ${Number(item.pricePerVialDollars).toFixed(2)}/Vial
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
