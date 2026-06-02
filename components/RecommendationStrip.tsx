'use client';

import React from 'react';
import { getProductImage } from '@/lib/categoryImage';

export interface RecommendationItem {
  id: string;
  name: string;
  slug: string | null;
  category: string | null;
  image_url: string | null;
  base_cost: number;
  retail_price?: number;
  unit_size?: string | null;
  unit_measure?: string | null;
  /**
   * Optional pre-resolved href. Use this when the caller is a Server
   * Component — passing a `buildHref` function across the server-to-client
   * boundary throws "Functions cannot be passed directly to Client
   * Components". Client-side callers can keep using `buildHref`.
   */
  href?: string | null;
}

interface Props {
  title?: string;
  recommendations: RecommendationItem[];
  loading?: boolean;
  primaryColor?: string;
  onSelect?: (productId: string) => void;
  buildHref?: (productId: string) => string | null;
  hideWhenEmpty?: boolean;
}

const cardBase: React.CSSProperties = {
  flex: '0 0 auto',
  width: 160,
  minWidth: 160,
  background: 'var(--surface-2)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 'var(--radius-lg)',
  padding: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  textDecoration: 'none',
  color: 'var(--white)',
};

export default function RecommendationStrip({
  title = 'You May Also Like',
  recommendations,
  loading = false,
  primaryColor = 'var(--teal)',
  onSelect,
  buildHref,
  hideWhenEmpty = true,
}: Props) {
  if (!loading && hideWhenEmpty && recommendations.length === 0) {
    return null;
  }

  return (
    <section
      style={{
        marginTop: 'var(--space-5)',
        paddingTop: 'var(--space-4)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        width: '100%',
        maxWidth: '100%',
      }}
    >
      <h3
        style={{
          fontSize: '0.92rem',
          color: 'var(--silver)',
          marginBottom: 'var(--space-3)',
          fontFamily: 'var(--font-brand)',
          letterSpacing: '0.02em',
        }}
      >
        {title}
      </h3>
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          overflowX: 'auto',
          overscrollBehaviorX: 'none',
          touchAction: 'pan-x',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 6,
          scrollbarWidth: 'thin',
          width: '100%',
          maxWidth: '100%',
        }}
      >
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`sk-${i}`}
                style={{
                  ...cardBase,
                  cursor: 'default',
                  background:
                    'linear-gradient(90deg, var(--surface-2) 0%, rgba(255,255,255,0.04) 50%, var(--surface-2) 100%)',
                  height: 200,
                }}
                aria-hidden="true"
              />
            ))
          : recommendations.map((item) => {
              const displayName = item.unit_size
                ? `${item.name} ${item.unit_size}${item.unit_measure || ''}`
                : item.name;

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
                    }}
                  >
                    {getProductImage(item.image_url, item.category || 'Other', item.name) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={getProductImage(item.image_url, item.category || 'Other', item.name)}
                        alt={item.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          padding: 8,
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          const fallback = getProductImage(null, item.category || 'Other', item.name);
                          if (target.src !== fallback) {
                            target.src = fallback;
                          }
                        }}
                      />
                    ) : (
                      <span style={{ color: 'var(--grey-600)', fontSize: '0.65rem' }}>
                        No Image
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--white)',
                      fontWeight: 700,
                      lineHeight: 1.25,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textTransform: 'capitalize',
                    }}
                  >
                    {displayName}
                  </div>
                  {typeof item.retail_price === 'number' && item.retail_price > 0 ? (
                    <div
                      style={{
                        fontSize: '0.82rem',
                        color: primaryColor,
                        fontWeight: 800,
                        fontFamily: 'var(--font-brand)',
                      }}
                    >
                      ${item.retail_price.toFixed(2)}
                    </div>
                  ) : item.category ? (
                    <div style={{ fontSize: '0.7rem', color: 'var(--grey-500)' }}>
                      {item.category}
                    </div>
                  ) : null}
                </>
              );
              // Per-item href (server-component safe) takes precedence over
              // the client-side buildHref function prop.
              const resolvedHref =
                (item.href && item.href.length > 0) ? item.href : (buildHref ? buildHref(item.id) : null);
              if (resolvedHref) {
                return (
                  <a key={item.id} href={resolvedHref} style={cardBase}>
                    {inner}
                  </a>
                );
              }
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect?.(item.id)}
                  style={{ ...cardBase, textAlign: 'left' }}
                >
                  {inner}
                </button>
              );
            })}
      </div>
    </section>
  );
}
