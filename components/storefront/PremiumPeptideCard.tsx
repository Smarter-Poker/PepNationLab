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
  // Helper to convert 683x1024 canvas pixels to responsive CQI units
  const px = (val: number) => `calc(${val} * 100cqi / 683)`;
  
  return (
    <div 
      style={{ containerType: 'inline-size', width: '100%', maxWidth: 683, margin: '0 auto', cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={onHover}
      role="button"
      tabIndex={0}
      aria-label={`View Details For ${productName}`}
    >
      <div style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '149.92679%', // 1024 / 683
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
          
          {/* 1. Vial Image - Edge to Edge inside the top frame */}
          <div style={{
            position: 'absolute',
            left: px(25), top: px(25), right: px(25), height: px(490),
            borderRadius: `${px(25)} ${px(25)} 0 0`,
            overflow: 'hidden',
            zIndex: 15 // Underneath top controls, above background
          }}>
            <Image
              src={imageSrc}
              alt={productName}
              fill
              style={{ objectFit: 'cover' }}
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
          <div style={{
            position: 'absolute',
            left: px(30), top: px(25), width: px(70), height: px(70),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 30
          }}>
            <input
              type="checkbox"
              checked={isPinned}
              onChange={onCompareToggle}
              onClick={e => e.stopPropagation()}
              style={{
                width: px(45), height: px(45),
                cursor: 'pointer',
                opacity: isPinned ? 1 : 0, 
                accentColor: '#00e5ff'
              }}
            />
          </div>

          {/* --- FAVORITE HEART (Top Right) --- */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onWishlistToggle) onWishlistToggle(e);
            }}
            style={{
              position: 'absolute',
              right: px(35), top: px(25),
              width: px(85), height: px(85),
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
              <svg width={px(40)} height={px(40)} viewBox="0 0 24 24" fill="#FF5A6E" stroke="#FF5A6E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            )}
          </button>


          {/* --- PRODUCT NAME AREA --- */}
          {/* 2 & 3. One line only, Silver gradient */}
          <div style={{
            position: 'absolute',
            left: px(60), top: px(580), width: px(340),
            zIndex: 30, pointerEvents: 'none'
          }}>
            <h2 style={{
              margin: 0,
              fontFamily: 'var(--font-montserrat, sans-serif)',
              fontWeight: 700,
              fontSize: px(40), // Slightly smaller to ensure fit
              letterSpacing: px(-1),
              lineHeight: 1.1,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              // Silver Gradient
              background: 'linear-gradient(180deg, #FFFFFF 0%, #B9C0C7 40%, #828A92 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: `0 ${px(4)} ${px(6)} rgba(0,0,0,0.8)`
            }}>
              {productName}
            </h2>
          </div>

          {/* --- SIZE BADGE AREA (Inside the Pill box) --- */}
          {/* 3. Silver gradient for weights */}
          <div style={{
            position: 'absolute',
            left: px(51), top: px(664), width: px(319), height: px(89),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 30, pointerEvents: 'none'
          }}>
            <span style={{
              fontFamily: 'var(--font-montserrat, sans-serif)',
              fontWeight: 800,
              fontSize: px(34),
              letterSpacing: px(1),
              textTransform: 'uppercase',
              // Silver Gradient
              background: 'linear-gradient(180deg, #FFFFFF 0%, #B9C0C7 40%, #828A92 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: `0 ${px(2)} ${px(4)} rgba(0,0,0,0.8)`
            }}>
              {vialSizeBadge}
            </span>
          </div>


          {/* --- PRICING AREA (Right Side) --- */}
          {/* 4. Center MSRP, YOU SAVE, and WHOLESALE PRICE above each other */}
          
          {(msrp !== undefined && msrp > (wholesalePrice ?? 0)) && (
            <>
              {/* Centered MSRP */}
              <div style={{
                position: 'absolute',
                left: px(380), width: px(280), top: px(590),
                display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: px(8),
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

              {/* Centered Savings Text */}
              {savings !== undefined && savings > 0 && (
                <div style={{
                  position: 'absolute',
                  left: px(380), width: px(280), top: px(635),
                  display: 'flex', justifyContent: 'center',
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

          {/* Centered Wholesale Price Digits */}
          <div style={{
            position: 'absolute',
            left: px(380), width: px(280), top: px(710),
            display: 'flex', justifyContent: 'center',
            fontFamily: 'var(--font-roboto-condensed, sans-serif)',
            fontWeight: 700,
            fontSize: px(65),
            color: '#00D5F2', 
            lineHeight: 1,
            textShadow: `0 ${px(4)} ${px(10)} rgba(0,0,0,0.5)`,
            zIndex: 30, pointerEvents: 'none'
          }}>
            ${(wholesalePrice ?? 0).toFixed(2)}
          </div>


          {/* --- ADD TO CART BUTTON (Invisible overlay) --- */}
          <div 
            style={{
              position: 'absolute',
              left: px(46), top: px(800), width: px(591), height: px(115),
              borderRadius: px(57.5),
              cursor: 'pointer',
              zIndex: 30
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (onAddToCart) onAddToCart(e);
            }}
            aria-label={buttonText}
          />
          
          {/* --- 5. DARKER BOTTOM PILL OVERLAY --- */}
          {/* Overlays the baked-in pill to make it look darker and more premium */}
          <div style={{
            position: 'absolute',
            left: px(46), right: px(46), top: px(909), height: px(48),
            background: '#070A0D', // Very dark background to block out the baked-in one
            border: `${px(1)} solid #232B35`,
            borderRadius: px(24),
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: px(16),
            zIndex: 25, pointerEvents: 'none'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: px(8) }}>
              <svg width={px(18)} height={px(18)} viewBox="0 0 24 24" fill="none" stroke="#00A2B8" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
              <span style={{ fontFamily: 'var(--font-roboto-condensed, sans-serif)', fontWeight: 700, fontSize: px(17), color: '#00A2B8', letterSpacing: px(1) }}>IN STOCK</span>
            </div>
            <div style={{ width: px(2), height: px(22), background: '#232B35' }} />
            <span style={{ fontFamily: 'var(--font-roboto-condensed, sans-serif)', fontWeight: 700, fontSize: px(16), color: '#6A7682', letterSpacing: px(1) }}>AVAILABLE FOR SAME DAY PICKUP</span>
          </div>

        </div>
      </div>
    </div>
  );
}

