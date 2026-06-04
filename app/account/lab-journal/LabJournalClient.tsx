'use client';

import { useState, useTransition } from 'react';
import { Heart, Trash2, ExternalLink, PackageOpen, History } from 'lucide-react';
import Link from 'next/link';
import { getProductImage } from '@/lib/categoryImage';

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
  viewed_at?: string;
  is_on_sale?: boolean;
  agent_product_id?: string | null;
}

interface Props {
  favorites: Item[];
  pastOrders: Item[];
  recentlyViewed: Item[];
  trending: { id: string; name: string; image_url: string | null; category: string | null; }[];
  storefrontSlug: string | null;
}

export default function LabJournalClient({ favorites: initialFavorites, pastOrders, recentlyViewed: initialRecentlyViewed, trending, storefrontSlug }: Props) {
  const [favorites, setFavorites] = useState<Item[]>(initialFavorites);
  const [recentlyViewed, setRecentlyViewed] = useState<Item[]>(initialRecentlyViewed);
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'favorites' | 'recentlyViewed' | 'pastOrders'>('favorites');

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

  async function clearRecentlyViewed() {
    if (!confirm('Are you sure you want to clear your recently viewed history?')) return;
    try {
      const res = await fetch('/api/researcher/recently-viewed', { method: 'DELETE' });
      if (res.ok) {
        startTransition(() => {
          setRecentlyViewed([]);
        });
      }
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  }

  function timeAgo(iso: string): string {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - then);
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'Just Now';
    if (mins < 60) return `${mins} Minute${mins === 1 ? '' : 's'} Ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} Hour${hrs === 1 ? '' : 's'} Ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days} Day${days === 1 ? '' : 's'} Ago`;
    return new Date(iso).toLocaleDateString();
  }

  function handleQuickAdd(item: Item) {
    if (!storefrontSlug) return;
    try {
      const storageKey = `pnl_storefront_cart_${storefrontSlug}`;
      const rawCart = localStorage.getItem(storageKey);
      let pnlCart = { items: [] as any[], _savedAt: Date.now() };
      if (rawCart) {
        try { pnlCart = JSON.parse(rawCart); } catch {}
      }

      // Add or increment item
      const existing = pnlCart.items.find((i: any) => i.id === item.product_id);
      if (existing) {
        existing.quantity += 1;
      } else {
        const perVial = item.retail_price ?? item.base_cost ?? 0;
        pnlCart.items.push({
          id: item.product_id,
          name: `${item.name} ${item.unit_size ? `(${item.unit_size}${item.unit_measure || ''})` : ''}`.trim(),
          sku: item.product_id,
          quantity: 1,
          retailPrice: perVial,
          costPrice: perVial, // Simplified for researcher quick-add
          weightOz: 0.5,
          agentSelfBuy: false,
        });
      }

      pnlCart._savedAt = Date.now();
      localStorage.setItem(storageKey, JSON.stringify(pnlCart));

      // Also write to the simple quantity map for the grid component
      if (item.agent_product_id) {
        const gridKey = `cart_${storefrontSlug}`;
        const rawGrid = localStorage.getItem(gridKey);
        let gridMap: Record<string, number> = {};
        if (rawGrid) {
          try { gridMap = JSON.parse(rawGrid) || {}; } catch {}
        }
        gridMap[item.agent_product_id] = (gridMap[item.agent_product_id] || 0) + 1;
        localStorage.setItem(gridKey, JSON.stringify(gridMap));
      }

      // Trigger a storage event manually so other tabs/components can sync if needed
      window.dispatchEvent(new Event('storage'));
      
      // Visual feedback
      const btn = document.getElementById(`quick-add-${item.product_id}`);
      if (btn) {
        const originalText = btn.innerText;
        btn.innerText = 'Added!';
        btn.style.background = 'var(--teal)';
        btn.style.color = 'var(--black)';
        setTimeout(() => {
          btn.innerText = originalText;
          btn.style.background = '';
          btn.style.color = '';
        }, 1500);
      }
    } catch (err) {
      console.error('Failed to quick add:', err);
    }
  }

  const renderGrid = (items: Item[], type: 'favorites' | 'pastOrders' | 'recentlyViewed') => {
    if (items.length === 0) {
      return (
        <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-8)', textAlign: 'center', animationDelay: '0.1s' }}>
          {type === 'favorites' ? (
            <Heart size={32} aria-hidden="true" style={{ marginBottom: 'var(--space-3)', color: 'var(--silver)' }} />
          ) : type === 'pastOrders' ? (
            <PackageOpen size={32} aria-hidden="true" style={{ marginBottom: 'var(--space-3)', color: 'var(--silver)' }} />
          ) : (
            <History size={32} aria-hidden="true" style={{ marginBottom: 'var(--space-3)', color: 'var(--silver)' }} />
          )}
          <h2 style={{ color: 'var(--white)', fontSize: '1.1rem', marginBottom: 'var(--space-2)' }}>
            {type === 'favorites' ? 'Your Wishlist Is Empty' : type === 'pastOrders' ? 'No Past Orders Found' : 'Nothing Here Yet'}
          </h2>
          <p style={{ color: 'var(--silver)', fontSize: '0.9rem' }}>
            {type === 'favorites' ? 'Tap The Heart Icon On Any Product To Save It Here For Later.' : type === 'pastOrders' ? 'Items you purchase will appear here for easy re-ordering.' : 'Browse Products On A Storefront And They Will Appear Here.'}
          </p>
          {storefrontSlug && (
            <Link href={`/${storefrontSlug}`} className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-4)' }}>
              Browse The Catalog
            </Link>
          )}
        </div>
      );
    }

    if (type === 'recentlyViewed') {
      return (
        <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 0, overflow: 'hidden', animationDelay: '0.1s' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map((item, idx) => {
              const displayPrice = item.retail_price ?? item.base_cost ?? 0;
              return (
                <li
                  key={item.product_id}
                  className="table-row-hover"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderTop: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      flexShrink: 0,
                      borderRadius: 8,
                      background: 'var(--surface-2)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {item.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.image_url}
                        alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          const fallback = getProductImage(null, item.category || 'Other', item.name);
                          if (target.src !== fallback && target.src !== window.location.origin + fallback) {
                            target.src = fallback;
                          } else {
                            target.src = '/images/peptide_clear.png';
                            target.style.opacity = '0.9';
                          }
                        }}
                      />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={getProductImage(null, item.category || 'Other', item.name)}
                        alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--white)', fontWeight: 700, fontSize: '0.92rem' }}>
                      {item.name}
                    </div>
                    <div style={{ color: 'var(--silver)', fontSize: '0.78rem' }}>
                      {item.category ?? 'Research Compound'} {item.viewed_at ? `- Viewed ${timeAgo(item.viewed_at)}` : ''}
                    </div>
                  </div>
                  {displayPrice > 0 && (
                    <div style={{ color: 'var(--teal)', fontWeight: 800, fontFamily: 'var(--font-brand)', fontSize: '1rem' }}>
                      ${displayPrice.toFixed(2)}
                    </div>
                  )}
                  {storefrontSlug && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <Link
                        href={`/${storefrontSlug}?product=${encodeURIComponent(item.product_id)}`}
                        className="btn btn-secondary btn-sm"
                      >
                        View
                      </Link>
                      <button
                        id={`quick-add-${item.product_id}`}
                        onClick={() => handleQuickAdd(item)}
                        className="btn btn-primary btn-sm"
                        style={{ transition: 'all 0.2s ease' }}
                        disabled={item.in_stock === false}
                      >
                        Add
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {type === 'pastOrders' && (
          <div className="glass-panel" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--surface-1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <PackageOpen size={18} style={{ color: 'var(--teal)' }} />
              <span style={{ color: 'var(--silver)', fontSize: '0.9rem' }}>Looking for a specific receipt or tracking number?</span>
            </div>
            <Link href="/orders" className="btn btn-ghost btn-sm" style={{ color: 'var(--white)', whiteSpace: 'nowrap' }}>
              View Full Order History &rarr;
            </Link>
          </div>
        )}
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
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s' }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const fallback = getProductImage(null, item.category || 'Other', item.name);
                      if (target.src !== fallback && target.src !== window.location.origin + fallback) {
                        target.src = fallback;
                      } else {
                        target.src = '/images/peptide_clear.png';
                        target.style.opacity = '0.9';
                      }
                    }}
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={getProductImage(null, item.category || 'Other', item.name)}
                    alt={item.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s' }}
                  />
                )}
                {type === 'pastOrders' && item.last_purchased_date && (
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
                    zIndex: 1
                  }}>
                    Bought {new Date(item.last_purchased_date).toLocaleDateString()}
                  </div>
                )}
                
                {item.is_on_sale && (
                  <div style={{
                    position: 'absolute', top: 12, right: 12,
                    fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                    padding: '4px 10px', borderRadius: 'var(--radius-full)',
                    background: 'rgba(245,101,101,0.15)', border: '1px solid rgba(245,101,101,0.4)',
                    color: '#F56565', backdropFilter: 'blur(4px)',
                    zIndex: 1
                  }}>
                    Sale
                  </div>
                )}

                {item.in_stock === false && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'grayscale(100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 2
                  }}>
                    <div style={{
                      background: 'var(--black)',
                      color: 'var(--silver)',
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                      Out of Stock
                    </div>
                  </div>
                )}
              </div>
              <div style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', flexDirection: 'column', flex: 1 }}>
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
                      href={`/${storefrontSlug}?product=${encodeURIComponent(item.product_id)}`}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    >
                      <ExternalLink size={12} aria-hidden="true" />
                      View Product
                    </Link>
                  )}
                  {type === 'favorites' && (
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
          Wishlist
        </button>
        <button
          onClick={() => setActiveTab('recentlyViewed')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'recentlyViewed' ? 'var(--teal)' : 'var(--silver)',
            fontWeight: activeTab === 'recentlyViewed' ? 'bold' : 'normal',
            padding: 'var(--space-2) var(--space-4)',
            cursor: 'pointer',
            borderBottom: activeTab === 'recentlyViewed' ? '2px solid var(--teal)' : '2px solid transparent',
            transition: 'all 0.2s ease',
            fontSize: '0.95rem'
          }}
        >
          Recently Viewed
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

      {activeTab === 'favorites' && renderGrid(favorites, 'favorites')}
      {activeTab === 'recentlyViewed' && (
        <>
          {recentlyViewed.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-2)' }}>
              <button
                onClick={clearRecentlyViewed}
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--silver)', fontSize: '0.8rem', padding: '4px 12px' }}
              >
                Clear History
              </button>
            </div>
          )}
          {renderGrid(recentlyViewed, 'recentlyViewed')}
          {trending.length > 0 && (
            <div className="glass-panel hover-lift stagger-fade-in" style={{ marginTop: 'var(--space-6)', padding: 'var(--space-5) var(--space-5) var(--space-6)', animationDelay: '0.2s' }}>
              <h2 style={{ color: 'var(--white)', fontSize: '1.05rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-2)' }}>
                Trending Now
              </h2>
              <p style={{ color: 'var(--silver)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
                The Top Eight Products Researchers Have Ordered In The Last Sixty Days.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 'var(--space-3)',
                }}
              >
                {trending.map((t) => {
                  const inner = (
                    <>
                      <div
                        style={{
                          width: '100%',
                          aspectRatio: '1 / 1',
                          background: 'var(--black-2)',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 8,
                        }}
                      >
                        {t.image_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={t.image_url}
                            alt={t.name}
                            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              const fallback = getProductImage(null, t.category || 'Other', t.name);
                              if (target.src !== fallback && target.src !== window.location.origin + fallback) {
                                target.src = fallback;
                              } else {
                                target.src = '/images/peptide_clear.png';
                                target.style.opacity = '0.9';
                              }
                            }}
                          />
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={getProductImage(null, t.category || 'Other', t.name)}
                            alt={t.name}
                            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
                          />
                        )}
                      </div>
                      <div
                        style={{
                          color: 'var(--white)',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          lineHeight: 1.25,
                          marginBottom: 4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {t.name}
                      </div>
                      {t.category && (
                        <div style={{ color: 'var(--grey-500)', fontSize: '0.7rem' }}>
                          {t.category}
                        </div>
                      )}
                    </>
                  );
                  const baseStyle: React.CSSProperties = {
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 10,
                    background: 'var(--surface-2)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 'var(--radius-lg)',
                    textDecoration: 'none',
                    color: 'var(--white)',
                  };
                  if (storefrontSlug) {
                    return (
                      <Link
                        key={t.id}
                        href={`/${storefrontSlug}?product=${encodeURIComponent(t.id)}`}
                        style={baseStyle}
                      >
                        {inner}
                      </Link>
                    );
                  }
                  return (
                    <div key={t.id} style={baseStyle}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
      {activeTab === 'pastOrders' && renderGrid(pastOrders, 'pastOrders')}
    </div>
  );
}
