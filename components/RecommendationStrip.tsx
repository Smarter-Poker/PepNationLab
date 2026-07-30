'use client';

import React from 'react';
import Image from 'next/image';
import { getProductImage } from '@/lib/categoryImage';

export interface RecommendationItem {
  id: string;
  name: string;
  slug: string | null;
  category: string | null;
  image_url: string | null;
  base_cost?: number;
  retail_price?: number;
  unit_size?: string | null;
  unit_measure?: string | null;
}

interface Props {
  title?: string;
  recommendations: RecommendationItem[];
  loading?: boolean;
  primaryColor?: string;
  agentSlug?: string;
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
  agentSlug,
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
          // Isolate the carousel's horizontal scroll from the page WITHOUT
          // trapping vertical page-scroll: overscroll-behavior-x:none stops the
          // horizontal swipe from chaining to browser back/forward at the edge,
          // while touch-action pan-x pan-y still lets a vertical swipe that
          // starts on the strip scroll the page (a bare pan-x blocked it on
          // Android, so a thumb resting over this full-width strip could not
          // scroll the page up/down).
          overscrollBehaviorX: 'none',
          touchAction: 'pan-x pan-y',
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
              const displayPrice =
                typeof item.retail_price === 'number' ? item.retail_price : undefined;

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
                    {getProductImage(item.image_url, item.category || 'Other', item.name, false, agentSlug) ? (
                      <Image
                        src={getProductImage(item.image_url, item.category || 'Other', item.name, false, agentSlug)}
                        alt={item.name}
                        width={200}
                        height={200}
                        unoptimized
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          padding: 8,
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          const fallback = getProductImage(null, item.category || 'Other', item.name, false, agentSlug);
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
                  {typeof displayPrice === 'number' && displayPrice > 0 ? (
                    <div
                      style={{
                        fontSize: '0.82rem',
                        color: primaryColor,
                        fontWeight: 800,
                        fontFamily: 'var(--font-brand)',
                      }}
                    >
                      ${displayPrice.toFixed(2)}
                    </div>
                  ) : null}
                  {/* Research area / category pill */}
                  {item.category && (
                    <div style={{
                      fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.02em',
                      padding: '2px 7px', borderRadius: 99,
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: 'rgba(255,255,255,0.55)',
                      whiteSpace: 'nowrap', maxWidth: '100%',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      textTransform: 'capitalize',
                    }}>
                      {item.category}
                    </div>
                  )}
                </>
              );
              if (buildHref) {
                const href = buildHref(item.id);
                if (href) {
                  return (
                    <a key={item.id} href={href} style={cardBase}>
                      {inner}
                    </a>
                  );
                }
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
