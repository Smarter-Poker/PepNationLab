'use client';

import { useState, useTransition } from 'react';
import { Heart, Trash2, ExternalLink, PackageOpen } from 'lucide-react';
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
  last_purchased_date?: string;
}

interface Props {
  favorites: Item[];
  pastOrders: Item[];
  storefrontSlug: string | null;
}

export default function WishlistClient({ favorites: initialFavorites, pastOrders, storefrontSlug }: Props) {
  const [favorites, setFavorites] = useState<Item[]>(initialFavorites);
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'favorites' | 'pastOrders'>('favorites');

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
          setFavorites(prev => prev.filter(it => it.product_id !== productId));
        });
      }
    } finally {
      setPendingId(null);
    }
  }

  const renderGrid = (items: Item[], isFavorites: boolean) => {
    if (items.length === 0) {
      return (
        <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-8)', textAlign: 'center', animationDelay: '0.1s' }}>
          {isFavorites ? (
            <Heart size={32} aria-hidden="true" style={{ marginBottom: 'var(--space-3)', color: 'var(--silver)' }} />
          ) : (
            <PackageOpen size={32} aria-hidden="true" style={{ marginBottom: 'var(--space-3)', color: 'var(--silver)' }} />
          )}
          <h2 style={{ color: 'var(--white)', fontSize: '1.1rem', marginBottom: 'var(--space-2)' }}>
            {isFavorites ? 'Your Favorites Is Empty' : 'No Past Orders Found'}
          </h2>
          <p style={{ color: 'var(--silver)', fontSize: '0.9rem' }}>
            {isFavorites ? 'Tap The Heart Icon On Any Product To Save It Here For Later.' : 'Items you purchase will appear here for easy re-ordering.'}
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
        {items.map((item, index) => {
          const displayPrice = item.retail_price ?? item.base_cost ?? 0;
          return (
            <div
              key={item.product_id}
              className="glass-panel hover-lift stagger-fade-in"
              style={{
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                padding: 0,
                borderRadius: 'var(--radius-lg)',
                animationDelay: `${0.1 + index * 0.1}s`,
              }}
            >
              <div
                style={{
                  height: 160,
                  background: 'radial-gradient(circle at 50% 50%, rgba(192,184,168,0.10) 0%, var(--black) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative'
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
                {!isFavorites && item.last_purchased_date && (
                  <div style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    background: 'rgba(0,0,0,0.8)',
                    backdropFilter: 'blur(4px)',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.65rem',
                    color: 'var(--silver)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 'bold',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    Last Purchased: {new Date(item.last_purchased_date).toLocaleDateString()}
                  </div>
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
                  {isFavorites && (
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
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'var(--space-2)' }}>
        <button
          onClick={() => setActiveTab('favorites')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'favorites' ? 'var(--teal)' : 'var(--silver)',
            fontWeight: activeTab === 'favorites' ? 'bold' : 'normal',
            padding: 'var(--space-2) var(--space-4)',
            cursor: 'pointer',
            borderBottom: activeTab === 'favorites' ? '2px solid var(--teal)' : '2px solid transparent',
            transition: 'all 0.2s ease',
            fontSize: '0.95rem'
          }}
        >
          My Favorites
        </button>
        <button
          onClick={() => setActiveTab('pastOrders')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'pastOrders' ? 'var(--teal)' : 'var(--silver)',
            fontWeight: activeTab === 'pastOrders' ? 'bold' : 'normal',
            padding: 'var(--space-2) var(--space-4)',
            cursor: 'pointer',
            borderBottom: activeTab === 'pastOrders' ? '2px solid var(--teal)' : '2px solid transparent',
            transition: 'all 0.2s ease',
            fontSize: '0.95rem'
          }}
        >
          Buy It Again
        </button>
      </div>

      {activeTab === 'favorites' ? renderGrid(favorites, true) : renderGrid(pastOrders, false)}
    </div>
  );
}
