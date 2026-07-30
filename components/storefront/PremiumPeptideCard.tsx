'use client';

import React from 'react';
import Image from 'next/image';

interface Props {
  productName?: string;
  vialSizeBadge?: string;
  msrp?: number;
  savings?: number;
  wholesalePrice?: number;
  inStockText?: string;
  pickupText?: string;
  buttonText?: string;
  imageSrc?: string;
  isPinned?: boolean;
  isWishlisted?: boolean;
  onCompareToggle?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onWishlistToggle?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onClick?: () => void;
  onAddToCart?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onHover?: () => void;
  hasSearchMatch?: { reason?: string; confidence?: 'high' | 'medium' | 'low' } | null;
}

export default function PremiumPeptideCard({
  productName = "Tirzepatide",
  vialSizeBadge = "10mg Vials",
  msrp = 55.00,
  savings = 25.00,
  wholesalePrice = 29.97,
  inStockText = "IN STOCK",
  pickupText = "AVAILABLE FOR SAME DAY PICKUP",
  buttonText = "Add To Cart",
  imageSrc = "/images/savage-brands/tirzepatide.png",
  isPinned = false,
  isWishlisted = false,
  onCompareToggle,
  onWishlistToggle,
  onClick,
  onAddToCart,
  onHover,
  hasSearchMatch = null
}: Props) {
  // Helper to convert 675x1007 canvas pixels to responsive CQI units
  const px = (val: number) => `calc(${val} * 100cqi / 675)`;
  
  return (
    <div 
      style={{ containerType: 'inline-size', width: '100%', maxWidth: 675, margin: '0 auto', cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={onHover}
      role="button"
      tabIndex={0}
      aria-label={`View Details For ${productName}`}
    >
      <div style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '149.18518%', // 1007 / 675
        overflow: 'hidden',
        // Fallback fonts if custom fonts haven't loaded yet
        fontFamily: 'var(--font-sans, sans-serif)',
        transition: 'transform 0.2s',
      }}>
        {/* Exact background template provided by user */}
        <Image
          src="/images/storefront/premium-card-bg.jpg"
          alt="Card Background"
          fill
          priority
          style={{ objectFit: 'cover', pointerEvents: 'none', zIndex: 0 }}
        />

        {/* Global wrapper matching canvas size for absolute positioning over the background */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}>
          
          {/* Vial Image - Absolutely positioned */}
          {/* Vial bounds from previous design: Left: 50%, Top: 61, Height: 427 */}
          <div style={{
            position: 'absolute',
            left: '50%', top: px(61), height: px(427), width: px(290),
            transform: 'translateX(-50%) rotate(9deg)', // 8 to 10 deg clockwise
            zIndex: 20
          }}>
            <Image
              src={imageSrc}
              alt={productName}
              fill
              style={{ objectFit: 'contain', filter: `drop-shadow(0 ${px(20)} ${px(20)} rgba(0,0,0,0.9))` }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/images/peptide_clear.png';
              }}
            />
          </div>

          {/* --- SEARCH MATCH CHIP (Optional) --- */}
          {hasSearchMatch && hasSearchMatch.reason && (() => {
            const confidenceStyle: Record<'high' | 'medium' | 'low', { bg: string; border: string; color: string; label: string }> = {
              high:   { bg: 'rgba(79,209,197,0.12)',  border: 'rgba(79,209,197,0.35)',  color: '#4FD1C5', label: 'Strong Match' },
              medium: { bg: 'rgba(235,178,54,0.10)',  border: 'rgba(235,178,54,0.30)',  color: '#EBB236', label: 'Good Match'   },
              low:    { bg: 'rgba(160,174,192,0.08)', border: 'rgba(160,174,192,0.22)', color: '#A0AEC0', label: 'Partial Match' },
            };
            const cs = hasSearchMatch.confidence ? confidenceStyle[hasSearchMatch.confidence] : null;
            if (!cs) return null;
            return (
              <div style={{
                position: 'absolute', top: px(140), left: px(26), right: px(25), zIndex: 40,
                display: 'flex', justifyContent: 'center', pointerEvents: 'none'
              }}>
                <div style={{
                  background: 'rgba(20, 25, 30, 0.85)', backdropFilter: 'blur(8px)',
                  border: `1px solid ${cs.border}`, padding: `${px(4)} ${px(10)}`, borderRadius: px(20),
                  display: 'flex', alignItems: 'center', gap: px(6), fontSize: px(16),
                  fontWeight: 700, color: cs.color, boxShadow: `0 ${px(4)} ${px(12)} rgba(0,0,0,0.5)`,
                  maxWidth: '90%', textTransform: 'uppercase', letterSpacing: '0.04em'
                }}>
                  <svg width={px(16)} height={px(16)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cs.label}: {hasSearchMatch.reason}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* --- COMPARE CONTROL (Top Left) --- */}
          {/* Box bounds from image: roughly left 47, top 47 */}
          <div style={{
            position: 'absolute',
            left: px(47), top: px(47), width: px(70), height: px(70),
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            zIndex: 30
          }}>
            <input
              type="checkbox"
              checked={isPinned}
              onChange={onCompareToggle}
              onClick={e => e.stopPropagation()}
              style={{
                width: px(38), height: px(38),
                cursor: 'pointer',
                opacity: isPinned ? 1 : 0, // hide unless checked so it doesn't cover the image border if unstyled
                accentColor: '#00e5ff'
              }}
            />
          </div>

          {/* --- FAVORITE HEART (Top Right) --- */}
          {/* Heart bounds from image: roughly right ~50, top ~45 */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onWishlistToggle) onWishlistToggle(e);
            }}
            style={{
              position: 'absolute',
              right: px(52), top: px(45),
              width: px(66), height: px(66),
              background: isWishlisted ? 'rgba(229,62,62,0.8)' : 'transparent',
              border: 'none',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 30,
              cursor: 'pointer',
              padding: 0
            }}
          >
            {isWishlisted && (
              <svg width={px(28)} height={px(28)} viewBox="0 0 24 24" fill="#FF5A6E" stroke="#FF5A6E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            )}
          </button>


          {/* --- PRODUCT NAME AREA --- */}
          {/* Just above the pill box, left aligned */}
          <div style={{
            position: 'absolute',
            left: px(77), top: px(575), width: px(300),
            zIndex: 30, pointerEvents: 'none'
          }}>
            <h2 style={{
              margin: 0,
              fontFamily: 'var(--font-montserrat, sans-serif)',
              fontWeight: 600,
              fontSize: px(43),
              color: '#D5D7D8',
              lineHeight: 1.1,
              textShadow: `0 ${px(4)} ${px(6)} rgba(0,0,0,0.8)`
            }}>
              {productName}
            </h2>
          </div>

          {/* --- SIZE BADGE AREA (Inside the Pill box) --- */}
          {/* Box area on image: left ~50, top ~648, width ~315, height ~82 */}
          <div style={{
            position: 'absolute',
            left: px(50), top: px(648), width: px(315), height: px(82),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 30, pointerEvents: 'none'
          }}>
            <span style={{
              fontFamily: 'var(--font-montserrat, sans-serif)',
              fontWeight: 600,
              fontSize: px(35),
              color: '#D5D7D8',
              textShadow: `0 ${px(2)} ${px(4)} rgba(0,0,0,0.5)`
            }}>
              {vialSizeBadge}
            </span>
          </div>


          {/* --- PRICING AREA (Right Side) --- */}
          {/* MSRP Label: Left 406, Top 582 */}
          {(msrp !== undefined && msrp > (wholesalePrice ?? 0)) && (
            <>
              <div style={{
                position: 'absolute',
                left: px(406), top: px(582),
                display: 'flex', alignItems: 'baseline', gap: px(8),
                zIndex: 30, pointerEvents: 'none'
              }}>
                <span style={{
                  fontFamily: 'var(--font-roboto-condensed, sans-serif)',
                  fontWeight: 700,
                  fontSize: px(22),
                  color: '#8B8F93'
                }}>MSRP</span>
                <span style={{
                  fontFamily: 'var(--font-roboto-condensed, sans-serif)',
                  fontWeight: 700,
                  fontSize: px(25),
                  color: '#8B8F93',
                  textDecoration: 'line-through',
                  textDecorationThickness: px(2)
                }}>${msrp.toFixed(2)}</span>
              </div>

              {/* Savings Text: Left 406, Top 629 */}
              {savings !== undefined && savings > 0 && (
                <div style={{
                  position: 'absolute',
                  left: px(406), top: px(629),
                  fontFamily: 'var(--font-roboto-condensed, sans-serif)',
                  fontWeight: 700,
                  fontSize: px(23),
                  color: '#00C7E8',
                  textTransform: 'uppercase',
                  zIndex: 30, pointerEvents: 'none'
                }}>
                  YOU SAVE ${savings.toFixed(0)}
                </div>
              )}
            </>
          )}

          {/* Wholesale Price (Under the line): Left 406, Top 706 */}
          <div style={{
            position: 'absolute',
            left: px(406), top: px(706),
            fontFamily: 'var(--font-roboto-condensed, sans-serif)',
            fontWeight: 700,
            fontSize: px(62),
            color: '#00BFD8', // Bright teal
            lineHeight: 1,
            textShadow: `0 ${px(4)} ${px(10)} rgba(0,0,0,0.5)`,
            zIndex: 30, pointerEvents: 'none'
          }}>
            ${(wholesalePrice ?? 0).toFixed(2)}
          </div>


          {/* --- ADD TO CART BUTTON (Invisible overlay) --- */}
          {/* The image already has the button text. We just overlay an invisible clickable div over it. */}
          <div 
            style={{
              position: 'absolute',
              left: px(68), top: px(782), width: px(538), height: px(108),
              borderRadius: px(54),
              cursor: 'pointer',
              zIndex: 30
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (onAddToCart) onAddToCart(e);
            }}
            aria-label={buttonText}
          />

          {/* We omit rendering "IN STOCK" and "AVAILABLE FOR SAME DAY PICKUP" dynamically since they are baked into the image. */}
          {/* Note: The user requested ONLY dynamic vial image, weight, peptide name, MSRP, and wholesale price. */}
          
        </div>
      </div>
    </div>
  );
}

