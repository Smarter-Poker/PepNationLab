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
  // Helper to convert 832x1248 canvas pixels to responsive CQI units
  const px = (val: number) => `calc(${val} * 100cqi / 832)`;

  return (
    <div
      style={{ containerType: 'inline-size', width: '100%', maxWidth: 832, margin: '0 auto', cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={onHover}
      role="button"
      tabIndex={0}
      aria-label={`View Details For ${productName}`}
    >
      <div style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '150%', // 1248 / 832
        overflow: 'hidden',
        fontFamily: 'var(--font-sans, sans-serif)',
        transition: 'transform 0.2s',
      }}>
        {/* Store Frame V2 background — flat metallic separator bar design */}
        <Image
          src="/images/storefront/premium-card-bg.jpg"
          alt="Card Background"
          fill
          priority
          style={{ objectFit: 'cover', pointerEvents: 'none', zIndex: 0 }}
        />

        {/* Global wrapper for absolute-positioned overlays */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}>

          {/* ─── VIAL IMAGE ─────────────────────────────────────────────
              Sits in the top image window (above the flat metallic bar).
              The flat bar is at ~715px on the 1248 canvas → 57.3%.
              We stop the image container at 710px so the bar is always
              fully visible on top. Overflow:hidden gives a hard flat edge. */}
          <div style={{
            position: 'absolute',
            left: px(30), top: px(30), right: px(30), height: px(680),
            borderRadius: `${px(22)} ${px(22)} 0 0`,
            overflow: 'hidden',
            zIndex: 15,
          }}>
            <Image
              src={imageSrc}
              alt={productName}
              fill
              style={{ objectFit: 'cover', objectPosition: 'center center' }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/images/peptide_clear.png';
              }}
            />
          </div>

          {/* ─── SEARCH MATCH CHIP (optional) ───────────────────────── */}
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
                position: 'absolute', top: px(170), left: px(30), right: px(30), zIndex: 40,
                display: 'flex', justifyContent: 'center', pointerEvents: 'none'
              }}>
                <div style={{
                  background: 'rgba(20, 25, 30, 0.85)', backdropFilter: 'blur(8px)',
                  border: `1px solid ${cs.border}`, padding: `${px(5)} ${px(12)}`, borderRadius: px(24),
                  display: 'flex', alignItems: 'center', gap: px(7), fontSize: px(19),
                  fontWeight: 700, color: cs.color, boxShadow: `0 ${px(4)} ${px(14)} rgba(0,0,0,0.5)`,
                  maxWidth: '90%', textTransform: 'uppercase', letterSpacing: '0.04em'
                }}>
                  <svg width={px(18)} height={px(18)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cs.label}: {hasSearchMatch.reason}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* ─── COMPARE CHECKBOX (Top Left) ────────────────────────── */}
          <div style={{
            position: 'absolute',
            left: px(36), top: px(30), width: px(85), height: px(85),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 30
          }}>
            <input
              type="checkbox"
              checked={isPinned}
              onChange={onCompareToggle}
              onClick={e => e.stopPropagation()}
              style={{
                width: px(54), height: px(54),
                cursor: 'pointer',
                opacity: isPinned ? 1 : 0,
                accentColor: '#00e5ff'
              }}
            />
          </div>

          {/* ─── WISHLIST HEART (Top Right) ─────────────────────────── */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onWishlistToggle) onWishlistToggle(e);
            }}
            style={{
              position: 'absolute',
              right: px(42), top: px(30),
              width: px(100), height: px(100),
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
              <svg width={px(48)} height={px(48)} viewBox="0 0 24 24" fill="#FF5A6E" stroke="#FF5A6E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            )}
          </button>

          {/* ─── PRODUCT NAME ────────────────────────────────────────── 
              Sits in the dark info band just below the metallic bar.
              Bar bottom edge ≈ 730px, pill top ≈ 1000px → center ≈ 865px. */}
          {(() => {
            const len = productName.length;
            let dynamicFontSize = px(54);
            if (len > 22) dynamicFontSize = px(32);
            else if (len > 15) dynamicFontSize = px(38);
            else if (len > 11) dynamicFontSize = px(44);

            return (
              <div style={{
                position: 'absolute',
                left: px(30), top: px(730), width: px(430), height: px(140),
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                zIndex: 30, pointerEvents: 'none'
              }}>
                <h2 style={{
                  margin: 0,
                  fontFamily: 'var(--font-montserrat, sans-serif)',
                  fontWeight: 700,
                  fontSize: dynamicFontSize,
                  letterSpacing: px(-1),
                  lineHeight: 1.1,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textAlign: 'center',
                  background: 'linear-gradient(180deg, #FFFFFF 0%, #B9C0C7 40%, #828A92 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: `0 ${px(4)} ${px(6)} rgba(0,0,0,0.8)`
                }}>
                  {productName}
                </h2>
              </div>
            );
          })()}

          {/* ─── VIAL SIZE BADGE (inside the pill button on left) ────── 
              Pill in template: left ~62px, top ~990px, width ~390px, height ~108px */}
          <div style={{
            position: 'absolute',
            left: px(62), top: px(990), width: px(390), height: px(108),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 30, pointerEvents: 'none'
          }}>
            <span style={{
              fontFamily: 'var(--font-montserrat, sans-serif)',
              fontWeight: 800,
              fontSize: px(40),
              letterSpacing: px(1),
              textTransform: 'uppercase',
              background: 'linear-gradient(180deg, #FFFFFF 0%, #B9C0C7 40%, #828A92 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: `0 ${px(2)} ${px(4)} rgba(0,0,0,0.8)`
            }}>
              {vialSizeBadge}
            </span>
          </div>

          {/* ─── PRICING (Right column, below bar) ───────────────────── 
              WHOLESALE PRICE label ≈ top 760px, right section x≈468px, width≈332px */}

          {(msrp !== undefined && msrp > (wholesalePrice ?? 0)) && (
            <>
              {/* MSRP row */}
              <div style={{
                position: 'absolute',
                left: px(468), width: px(332), top: px(750),
                display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: px(7),
                zIndex: 30, pointerEvents: 'none'
              }}>
                <span style={{
                  fontFamily: 'var(--font-roboto-condensed, sans-serif)',
                  fontWeight: 700,
                  fontSize: px(31),
                  color: '#8B8F93'
                }}>MSRP</span>
                <span style={{
                  fontFamily: 'var(--font-roboto-condensed, sans-serif)',
                  fontWeight: 700,
                  fontSize: px(36),
                  color: '#8B8F93',
                  textDecoration: 'line-through',
                  textDecorationThickness: px(2)
                }}>${msrp.toFixed(2)}</span>
              </div>

              {/* YOU SAVE row */}
              {savings !== undefined && savings > 0 && (
                <div style={{
                  position: 'absolute',
                  left: px(468), width: px(332), top: px(800),
                  display: 'flex', justifyContent: 'center',
                  fontFamily: 'var(--font-roboto-condensed, sans-serif)',
                  fontWeight: 700,
                  fontSize: px(33),
                  color: '#00C7E8',
                  textTransform: 'uppercase',
                  zIndex: 30, pointerEvents: 'none'
                }}>
                  YOU SAVE ${savings.toFixed(0)}
                </div>
              )}
            </>
          )}

          {/* Wholesale Price digits */}
          <div style={{
            position: 'absolute',
            left: px(468), width: px(332), top: px(1010),
            display: 'flex', justifyContent: 'center',
            fontFamily: 'var(--font-roboto-condensed, sans-serif)',
            fontWeight: 700,
            fontSize: px(80),
            color: '#00D5F2',
            lineHeight: 1,
            textShadow: `0 ${px(4)} ${px(12)} rgba(0,0,0,0.5)`,
            zIndex: 30, pointerEvents: 'none'
          }}>
            ${(wholesalePrice ?? 0).toFixed(2)}
          </div>

          {/* ─── ADD TO CART (invisible click overlay) ───────────────── 
              Button in template: left ~56px, top ~1155px, width ~720px, height ~135px */}
          <div
            style={{
              position: 'absolute',
              left: px(56), top: px(1155), width: px(720), height: px(135),
              borderRadius: px(68),
              cursor: 'pointer',
              zIndex: 30
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (onAddToCart) onAddToCart(e);
            }}
            aria-label={buttonText}
          />

        </div>
      </div>
    </div>
  );
}
