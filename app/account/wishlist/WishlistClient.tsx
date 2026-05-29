'use client';

import { useState, useTransition } from 'react';
import { Heart, Trash2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Item {
  product_id: string;
  name: string;
  image_url: string | null;
  category: string | null;
  base_cost: number | null;
  retail_price: number | null;
  in_stock: boolean | null;
  unit_size: string | null;
  unit_measure: string | null;
}

interface Props {
  initialItems: Item[];
  storefrontSlug: string | null;
}

export default function WishlistClient({ initialItems, storefrontSlug }: Props) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function removeItem(productId: string) {
    setPendingId(productId);
    try {
      const res = await fetch('/api/researcher/wishlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ productId }),
      });
      if (res.ok) {
        startTransition(() => {
          setItems(prev => prev.filter(it => it.product_id !== productId));
        });
      }
    } finally {
      setPendingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="card-metal" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <Heart size={32} aria-hidden="true" style={{ marginBottom: 'var(--space-3)', color: 'var(--silver)' }} />
        <h2 style={{ color: 'var(--white)', fontSize: '1.1rem', marginBottom: 'var(--space-2)' }}>
          Your Wishlist Is Empty
        </h2>
        <p style={{ color: 'var(--silver)', fontSize: '0.9rem' }}>
          Tap The Heart Icon On Any Product To Save It Here For Later.
        </p>
        {storefrontSlug && (
          <Link href={`/${storefrontSlug}`} className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-4)' }}>
            Browse The Catalog
          </Link>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 'var(--space-4)',
      }}
    >
      {items.map(item => {
        const displayPrice = item.retail_price ?? item.base_cost ?? 0;
        return (
          <div
            key={item.product_id}
            className="card-metal"
            style={{
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: 0,
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div
              style={{
                height: 160,
                background: 'radial-gradient(circle at 50% 50%, rgba(0,196,188,0.10) 0%, var(--black) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {item.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={item.image_url}
                  alt={item.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ color: 'var(--grey-500)', fontSize: '0.75rem' }}>No Image</span>
              )}
            </div>
            <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flex: 1 }}>
              <div style={{ color: 'var(--white)', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3 }}>
                {item.name}
              </div>
              {item.category && (
                <div style={{ color: 'var(--silver)', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {item.category}
                </div>
              )}
              {displayPrice > 0 && (
                <div style={{ color: 'var(--teal)', fontWeight: 800, fontSize: '1.05rem', fontFamily: 'var(--font-brand)' }}>
                  ${displayPrice.toFixed(2)}
                  {item.unit_size && item.unit_measure && (
                    <span style={{ color: 'var(--grey-400)', fontSize: '0.75rem', fontWeight: 500, marginLeft: 6 }}>
                      / {item.unit_size}{item.unit_measure}
                    </span>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'auto', paddingTop: 'var(--space-2)' }}>
                {storefrontSlug && (
                  <Link
                    href={`/${storefrontSlug}`}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    <ExternalLink size={12} aria-hidden="true" />
                    View Storefront
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => void removeItem(item.product_id)}
                  disabled={pendingId === item.product_id}
                  className="btn btn-ghost btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--red)' }}
                  aria-label="Remove From Wishlist"
                >
                  <Trash2 size={12} aria-hidden="true" />
                  Remove
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
