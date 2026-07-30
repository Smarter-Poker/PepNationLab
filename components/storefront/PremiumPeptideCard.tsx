import React from 'react';
import Image from 'next/image';
import { Heart, Package } from 'lucide-react';

export default function PremiumPeptideCard() {
  const cyanColor = '#00e5ff';
  
  return (
    <div style={{
      width: '100%',
      maxWidth: 380,
      margin: '0 auto',
      background: '#04070a',
      borderRadius: 16,
      border: '2px solid #232933',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 10px 30px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.1)',
      fontFamily: 'var(--font-sans)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top Section - Image & Glow */}
      <div style={{
        position: 'relative',
        height: 380,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #090e14 0%, #030508 100%)',
        overflow: 'hidden',
      }}>
        {/* Top actions */}
        <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 18, height: 18, border: '1px solid rgba(255,255,255,0.4)', borderRadius: 3, marginBottom: 4 }} />
          <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--silver-light)', letterSpacing: '0.05em' }}>COMPARE</span>
        </div>
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <div style={{ 
            width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center' 
          }}>
            <Heart size={18} color="rgba(255,255,255,0.7)" />
          </div>
        </div>

        {/* Glow Ring */}
        <div style={{
          position: 'absolute',
          width: 220,
          height: 220,
          borderRadius: '50%',
          border: `2px solid ${cyanColor}`,
          boxShadow: `0 0 40px ${cyanColor}66, inset 0 0 40px ${cyanColor}66`,
          opacity: 0.6,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }} />

        {/* Product Image */}
        <div style={{ position: 'relative', zIndex: 10, width: 180, height: 280 }}>
          <Image
            src="/images/savage-brands/tirzepatide.png"
            alt="Tirzepatide"
            fill
            style={{ objectFit: 'contain', filter: 'drop-shadow(0 20px 20px rgba(0,0,0,0.8))' }}
          />
        </div>
        
        {/* Floor reflection fake */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: '10%',
          right: '10%',
          height: 40,
          background: `radial-gradient(ellipse at top, ${cyanColor}40 0%, transparent 70%)`,
          opacity: 0.5,
        }} />
      </div>

      {/* Chevron Divider SVG */}
      <div style={{ width: '100%', height: 24, marginTop: -12, position: 'relative', zIndex: 20 }}>
        <svg width="100%" height="24" viewBox="0 0 380 24" preserveAspectRatio="none" style={{ filter: 'drop-shadow(0 -4px 6px rgba(0,0,0,0.8))' }}>
          <path d="M0,0 L190,16 L380,0 L380,24 L0,24 L0,0 Z" fill="#0b1118" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
        </svg>
      </div>

      {/* Bottom Content Area */}
      <div style={{ background: '#0b1118', padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          {/* Left Col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{
              margin: '0',
              fontSize: '1.8rem',
              fontWeight: 800,
              background: 'linear-gradient(180deg, #ffffff 0%, #a0b4c8 50%, #607080 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.9))',
              lineHeight: 1
            }}>
              Tirzepatide
            </h2>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              padding: '6px 20px', borderRadius: 999,
              background: 'linear-gradient(180deg, #2b3744 0%, #1b242e 100%)',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 8px rgba(0,0,0,0.5)',
              alignSelf: 'flex-start'
            }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--silver-light)' }}>10mg Vials</span>
            </div>
          </div>
          
          {/* Right Col */}
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 8 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--grey-500)' }}>MSRP</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--grey-500)', textDecoration: 'line-through' }}>$55.00</span>
            </div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: cyanColor, textTransform: 'uppercase', marginBottom: 8 }}>
              YOU SAVE $25
            </div>
            <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.1)', marginBottom: 8 }} />
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--silver)', textTransform: 'uppercase' }}>
              WHOLESALE PRICE
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: cyanColor, lineHeight: 1, textShadow: `0 0 20px ${cyanColor}40` }}>
              $29.97
            </div>
          </div>
        </div>

        {/* Add To Cart Full Width */}
        <button style={{
          width: '100%',
          padding: '12px',
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #2c3846 0%, #1a222b 50%, #0d1218 100%)',
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -2px 6px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6)',
          color: 'var(--white)',
          cursor: 'pointer',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute', left: 8, width: 32, height: 32, borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 20a1 1 0 1 0 0 2 1 1 0 1 0 0-2zm7 0a1 1 0 1 0 0 2 1 1 0 1 0 0-2zm-9.8-2h12.6c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2H5.2L4.5 3H2v2h1.5l2.4 11H6.2z"/></svg>
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--silver-light)', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Add To Cart</span>
        </button>

      </div>

      {/* Footer Strip */}
      <div style={{
        background: 'linear-gradient(180deg, #090e14 0%, #04070a 100%)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: cyanColor }}>
          <Package size={16} />
          <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em' }}>IN STOCK</span>
        </div>
        <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.2)' }} />
        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--grey-400)', letterSpacing: '0.05em' }}>
          AVAILABLE FOR SAME DAY PICKUP
        </div>
      </div>
      
    </div>
  );
}
