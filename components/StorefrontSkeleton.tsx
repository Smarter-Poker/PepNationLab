'use client';

import React from 'react';

export default function StorefrontSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Search / filter bar placeholder */}
      <div className="sf-product-card-nickel" style={{
        height: 64,
        width: '100%',
        marginBottom: 24,
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0F1923',
      }}>
        <div style={{
          height: 38,
          width: '100%',
          borderRadius: 10,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer-flow 1.5s infinite linear',
        }} />
      </div>

      {/* Grid of 6 shimmering cards */}
      <div className="grid-3" style={{ gap: 'var(--space-6)' }}>
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={idx}
            className="sf-product-card-nickel"
            style={{
              padding: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              background: '#0F1923',
              height: 380,
            }}
          >
            {/* Shimmering Image area */}
            <div style={{
              height: 180,
              width: '100%',
              borderRadius: 14,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 75%)',
              backgroundSize: '200% 100%',
              animation: `shimmer-flow 1.5s infinite linear ${idx * 0.15}s`,
            }} />
            
            {/* Shimmering Title */}
            <div style={{
              height: 16,
              width: '70%',
              borderRadius: 4,
              alignSelf: 'center',
              background: 'linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 75%)',
              backgroundSize: '200% 100%',
              animation: `shimmer-flow 1.5s infinite linear ${idx * 0.15 + 0.1}s`,
            }} />

            {/* Shimmering Subtitle */}
            <div style={{
              height: 12,
              width: '50%',
              borderRadius: 4,
              alignSelf: 'center',
              background: 'linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 75%)',
              backgroundSize: '200% 100%',
              animation: `shimmer-flow 1.5s infinite linear ${idx * 0.15 + 0.2}s`,
            }} />

            {/* Shimmering Cost / Size */}
            <div style={{
              height: 20,
              width: '85%',
              borderRadius: 4,
              alignSelf: 'center',
              marginTop: 'auto',
              background: 'linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 75%)',
              backgroundSize: '200% 100%',
              animation: `shimmer-flow 1.5s infinite linear ${idx * 0.15 + 0.3}s`,
            }} />
          </div>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer-flow {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      ` }} />
    </div>
  );
}
