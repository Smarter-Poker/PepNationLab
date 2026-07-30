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
        background: '#000000',
        overflow: 'hidden',
        // Fallback fonts if custom fonts haven't loaded yet
        fontFamily: 'var(--font-sans, sans-serif)',
        transition: 'transform 0.2s',
      }}>
        {/* Global wrapper matching canvas size */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          
          {/* Main Card Frame */}
          <div style={{
            position: 'absolute',
            left: px(22), right: px(21), top: px(20), bottom: px(12),
            borderRadius: px(31),
            background: '#05090c',
            border: `${px(4)} solid #A5ACB4`, // Brushed Silver main border
            boxShadow: `inset 0 0 ${px(40)} rgba(0,0,0,0.9)`,
            overflow: 'hidden'
          }}>
            {/* Inner Border (8px inside the main frame border) */}
            <div style={{
              position: 'absolute',
              left: px(8), right: px(8), top: px(8), bottom: px(8),
              borderRadius: px(22),
              border: `${px(2)} solid #777B80`,
              pointerEvents: 'none',
              zIndex: 100,
            }} />
          </div>

          {/* --- TOP PRODUCT IMAGE AREA --- */}
          {/* The image area occupies the top portion. We use clip-path to create the angled divider at the bottom. */}
          <div style={{
            position: 'absolute',
            left: px(26), right: px(25), top: px(24), height: px(527),
            background: '#020304',
            clipPath: `polygon(0 0, 100% 0, 100% 100%, 50% calc(100% + ${px(28)}), 0 100%)`, // Approximating the downward slope
            zIndex: 10,
            overflow: 'hidden',
            borderTopLeftRadius: px(27),
            borderTopRightRadius: px(27),
          }}>
            {/* Cyan/Teal smoke behind vial */}
            <div style={{
              position: 'absolute',
              top: '20%', left: '10%', right: '10%', bottom: '20%',
              background: 'radial-gradient(ellipse at center, rgba(0, 213, 242, 0.25) 0%, transparent 60%)',
              filter: `blur(${px(30)})`,
            }} />

            {/* Circular Teal Energy Ring */}
            <div style={{
              position: 'absolute',
              width: px(220), height: px(220),
              left: '50%', top: '50%',
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              border: `${px(2)} solid #00CDEB`,
              boxShadow: `0 0 ${px(40)} rgba(0,205,235,0.6), inset 0 0 ${px(40)} rgba(0,205,235,0.6)`,
              opacity: 0.8
            }} />

            {/* Wet Black Reflective Floor */}
            <div style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0, height: px(120),
              background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 100%)',
              zIndex: 15
            }} />
            
            {/* Bright Teal Reflection Beneath Vial */}
            <div style={{
              position: 'absolute',
              bottom: px(10), left: '20%', right: '20%', height: px(60),
              background: 'radial-gradient(ellipse at center, rgba(0, 205, 235, 0.4) 0%, transparent 70%)',
              zIndex: 16
            }} />
          </div>

          {/* Vial Image - Absolutely positioned globally */}
          {/* Vial bounds: Top: 61, Bottom: 488 -> Height = 427. Center horiz. */}
          <div style={{
            position: 'absolute',
            left: '50%', top: px(61), height: px(427), width: px(290), // ~43% of 675
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
          {/* Left: 56, Top: 51 */}
          <div style={{
            position: 'absolute',
            left: px(56), top: px(51),
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            zIndex: 30
          }}>
            <input
              type="checkbox"
              checked={isPinned}
              onChange={onCompareToggle}
              onClick={e => e.stopPropagation()}
              style={{
                width: px(33), height: px(33),
                backgroundColor: '#05090C',
                border: `${px(2)} solid #777B80`,
                borderRadius: px(6),
                marginBottom: px(4),
                cursor: 'pointer',
                accentColor: '#00e5ff'
              }}
            />
            <span style={{
              fontFamily: 'var(--font-roboto-condensed, sans-serif)',
              fontWeight: 700,
              color: '#FFFFFF',
              fontSize: px(17),
              letterSpacing: px(0.5)
            }}>COMPARE</span>
          </div>

          {/* --- FAVORITE HEART (Top Right) --- */}
          {/* Left: 557, Top: 48, Diameter 66 */}
          <button
            type="button"
            onClick={onWishlistToggle}
            style={{
              position: 'absolute',
              left: px(557), top: px(48),
              width: px(66), height: px(66),
              backgroundColor: isWishlisted ? 'rgba(229,62,62,0.15)' : '#000000',
              border: `${px(2)} solid ${isWishlisted ? '#FF5A6E' : '#777B80'}`,
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 30,
              cursor: 'pointer',
              padding: 0
            }}
          >
            <svg width={px(28)} height={px(28)} viewBox="0 0 24 24" fill={isWishlisted ? '#FF5A6E' : 'none'} stroke={isWishlisted ? '#FF5A6E' : '#FFFFFF'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>

          {/* --- ANGLED SECTION DIVIDER --- */}
          {/* Left begins 35, Right ends 640. Starts 520, Center point 548 */}
          <svg style={{
            position: 'absolute',
            left: px(35), right: px(35), top: px(520), height: px(28),
            width: `calc(100% - ${px(70)})`,
            zIndex: 25,
            filter: `drop-shadow(0 ${px(4)} ${px(6)} rgba(0,0,0,0.9))`
          }} preserveAspectRatio="none" viewBox="0 0 605 28">
            <path d="M0,0 L302.5,28 L605,0 L605,28 L0,28 Z" fill="#11161A" stroke="#C0C5CA" strokeWidth="2" />
          </svg>

          {/* --- LOWER CARD BACKGROUND --- */}
          {/* To seamlessly connect with the divider, we fill the bottom area below 548 */}
          <div style={{
            position: 'absolute',
            left: px(26), right: px(25), top: px(548), bottom: px(16),
            background: '#11161A', // Textured Charcoal
            zIndex: 10,
            borderBottomLeftRadius: px(27),
            borderBottomRightRadius: px(27),
          }} />


          {/* --- PRODUCT NAME AREA --- */}
          {/* Name: Left 77, Top 575, Width 300 */}
          <div style={{
            position: 'absolute',
            left: px(77), top: px(575), width: px(300),
            zIndex: 30
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

          {/* Size Badge: Left 74, Top 650, Width 287, Height 78 */}
          <div style={{
            position: 'absolute',
            left: px(74), top: px(650), width: px(287), height: px(78),
            borderRadius: px(20),
            border: `${px(2)} solid #8B8F93`, // Outer brushed silver
            background: '#05090C',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 ${px(6)} ${px(12)} rgba(0,0,0,0.6)`,
            zIndex: 30
          }}>
            <div style={{
              position: 'absolute', inset: px(2), borderRadius: px(17),
              border: `${px(1)} solid #292D31`, // Inner thin dark gray
              pointerEvents: 'none'
            }} />
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

          {/* --- PRICING AREA --- */}
          {/* Vertical Divider: Left 395, Top 567 to 775 */}
          <div style={{
            position: 'absolute',
            left: px(395), top: px(567), width: px(2), height: px(208),
            background: '#777B80',
            zIndex: 30
          }}>
            {/* Brackets */}
            <div style={{ position: 'absolute', top: 0, left: px(-4), width: px(10), height: px(2), background: '#777B80' }} />
            <div style={{ position: 'absolute', bottom: 0, left: px(-4), width: px(10), height: px(2), background: '#777B80' }} />
          </div>

          {/* MSRP Label: Left 431, Top 582 */}
          {(msrp !== undefined && msrp > (wholesalePrice ?? 0)) && (
            <>
              <div style={{
                position: 'absolute',
                left: px(431), top: px(582),
                display: 'flex', alignItems: 'baseline', gap: px(8),
                zIndex: 30
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

              {/* Savings Text: Left 431, Top 629 */}
              {savings !== undefined && savings > 0 && (
                <div style={{
                  position: 'absolute',
                  left: px(431), top: px(629),
                  fontFamily: 'var(--font-roboto-condensed, sans-serif)',
                  fontWeight: 700,
                  fontSize: px(23),
                  color: '#00C7E8',
                  textTransform: 'uppercase',
                  zIndex: 30
                }}>
                  YOU SAVE ${savings.toFixed(0)}
                </div>
              )}
            </>
          )}

          {/* Thin Divider: Left 428, Top 666, Width 188 */}
          <div style={{
            position: 'absolute',
            left: px(428), top: px(666), width: px(188), height: px(1),
            background: '#006E7B',
            zIndex: 30
          }} />

          {/* Wholesale Label: Left 425, Top 681 */}
          <div style={{
            position: 'absolute',
            left: px(425), top: px(681),
            fontFamily: 'var(--font-roboto-condensed, sans-serif)',
            fontWeight: 700,
            fontSize: px(19),
            color: '#D5D7D8',
            zIndex: 30
          }}>
            WHOLESALE PRICE
          </div>

          {/* Wholesale Price: Left 406, Top 706 */}
          <div style={{
            position: 'absolute',
            left: px(406), top: px(706),
            fontFamily: 'var(--font-roboto-condensed, sans-serif)',
            fontWeight: 700,
            fontSize: px(62),
            color: '#00BFD8', // Bright teal
            lineHeight: 1,
            textShadow: `0 ${px(4)} ${px(10)} rgba(0,0,0,0.5)`,
            zIndex: 30
          }}>
            ${(wholesalePrice ?? 0).toFixed(2)}
          </div>


          {/* --- ADD TO CART BUTTON --- */}
          {/* Left 91, Top 792, Width 494, Height 95 */}
          <div 
            style={{
              position: 'absolute',
              left: px(91), top: px(792), width: px(494), height: px(95),
              borderRadius: px(47.5),
              background: '#11161A', // Black-charcoal
              border: `${px(3)} solid #8B8F93`, // Brushed silver
              boxShadow: `inset 0 ${px(2)} ${px(4)} rgba(255,255,255,0.1), 0 ${px(6)} ${px(12)} rgba(0,0,0,0.8)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 30
            }}
            onClick={onAddToCart}
          >
            {/* Inner Border */}
            <div style={{
              position: 'absolute', inset: px(2), borderRadius: px(45),
              border: `${px(1)} solid #292D31`, // Dark silver inner
              pointerEvents: 'none'
            }} />
            
            {/* Cart Medallion */}
            <div style={{
              position: 'absolute',
              left: px(6), top: px(6),
              width: px(83), height: px(83),
              borderRadius: '50%',
              border: `${px(2)} solid #8B8F93`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width={px(32)} height={px(32)} viewBox="0 0 24 24" fill="none" stroke="#D5D7D8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
            </div>

            {/* Button Text */}
            <span style={{
              fontFamily: 'var(--font-montserrat, sans-serif)',
              fontWeight: 600,
              fontSize: px(39),
              color: '#D5D7D8',
              letterSpacing: px(0.5),
              textShadow: `0 ${px(2)} ${px(4)} rgba(0,0,0,0.5)`,
              marginLeft: px(40) // offset from centered to account for left icon
            }}>
              {buttonText}
            </span>
          </div>


          {/* --- AVAILABILITY BAR --- */}
          {/* Left 57, Top 906, Width 559, Height 56 */}
          <div style={{
            position: 'absolute',
            left: px(57), top: px(906), width: px(559), height: px(56),
            background: '#05080B',
            border: `${px(2)} solid #8B8F93`,
            display: 'flex', alignItems: 'center',
            boxShadow: `inset 0 ${px(4)} ${px(8)} rgba(0,0,0,0.5)`,
            zIndex: 30,
            borderRadius: px(6)
          }}>
            {/* Left Section */}
            <div style={{
              width: px(230),
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: px(12)
            }}>
              {inStockText === 'OUT OF STOCK' ? (
                <span style={{
                  fontFamily: 'var(--font-roboto-condensed, sans-serif)',
                  fontWeight: 700,
                  fontSize: px(24),
                  color: '#e53e3e',
                  letterSpacing: px(0.5)
                }}>
                  {inStockText}
                </span>
              ) : (
                <>
                  <svg width={px(24)} height={px(24)} viewBox="0 0 24 24" fill="none" stroke="#00D5F2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                  <span style={{
                    fontFamily: 'var(--font-roboto-condensed, sans-serif)',
                    fontWeight: 700,
                    fontSize: px(24),
                    color: '#00D5F2',
                    letterSpacing: px(0.5)
                  }}>
                    {inStockText}
                  </span>
                </>
              )}
            </div>

            {/* Center Divider: At 287 (relative to card left 57, so inside bar it is 287-57 = 230) */}
            <div style={{ width: px(2), height: px(34), background: '#006E7B' }} />

            {/* Right Section */}
            <div style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <span style={{
                fontFamily: 'var(--font-roboto-condensed, sans-serif)',
                fontWeight: 700,
                fontSize: px(16),
                color: '#D5D7D8',
                letterSpacing: px(0.5)
              }}>
                {pickupText}
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
