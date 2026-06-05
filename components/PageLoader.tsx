'use client';

import React from 'react';
import { Sparkles, FlaskConical } from 'lucide-react';

interface PageLoaderProps {
  open: boolean;
  title?: string;
  subtitle?: string;
}

export default function PageLoader({
  open,
  title = 'Initializing Research Environment',
  subtitle = 'Pep Nation Lab is preparing your secure storefront...',
}: PageLoaderProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Loading Page"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(3, 7, 12, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      {/* Background soft ambient glowing circles */}
      <div
        style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 196, 188, 0.08) 0%, transparent 70%)',
          top: '15%',
          left: '20%',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(192, 184, 168, 0.05) 0%, transparent 75%)',
          bottom: '10%',
          right: '15%',
          filter: 'blur(50px)',
          pointerEvents: 'none',
        }}
      />

      {/* Main Content Box */}
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Pulsing & Shimmering Flask Icon Container */}
        <div style={{ position: 'relative', marginBottom: 28 }}>
          {/* Glowing outer shadow ring */}
          <div
            style={{
              position: 'absolute',
              inset: -12,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(0, 196, 188, 0.25) 0%, transparent 70%)',
              animation: 'pulse-glow 2.5s infinite ease-in-out',
            }}
          />
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: '24px',
              background: 'linear-gradient(135deg, #1e2530 0%, #0d121a 100%)',
              border: '1px solid rgba(0, 196, 188, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0, 196, 188, 0.15)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <FlaskConical size={36} color="#00C4BC" style={{ opacity: 0.95 }} />

            {/* Shimmer diagonal shine line */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '-150%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent 30%, rgba(255, 255, 255, 0.2) 50%, transparent 70%)',
                transform: 'skewX(-25deg)',
                animation: 'icon-shine 2s infinite ease-in-out',
              }}
            />
          </div>
        </div>

        {/* Text Area */}
        <h3
          style={{
            fontSize: '1.25rem',
            fontWeight: 900,
            color: '#FFFFFF',
            fontFamily: 'var(--font-brand, system-ui)',
            letterSpacing: '0.04em',
            margin: '0 0 10px 0',
            textTransform: 'uppercase',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {title} <Sparkles size={16} color="#00C4BC" className="spin-slow" />
        </h3>
        <p
          style={{
            fontSize: '0.88rem',
            color: 'rgba(192, 184, 168, 0.7)',
            lineHeight: 1.5,
            margin: '0 0 32px 0',
            fontWeight: 500,
          }}
        >
          {subtitle}
        </p>

        {/* Shimmering Skeletons */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Skeleton Item 1 */}
          <div
            style={{
              height: 52,
              borderRadius: 14,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 75%)',
              backgroundSize: '200% 100%',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              animation: 'shimmer-flow 1.5s infinite linear',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              gap: 12,
            }}
          >
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />
            <div style={{ height: 10, width: '40%', borderRadius: 4, background: 'rgba(255,255,255,0.04)' }} />
            <div style={{ height: 8, width: '20%', borderRadius: 4, background: 'rgba(255,255,255,0.02)', marginLeft: 'auto' }} />
          </div>

          {/* Skeleton Item 2 */}
          <div
            style={{
              height: 52,
              borderRadius: 14,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 75%)',
              backgroundSize: '200% 100%',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              animation: 'shimmer-flow 1.5s infinite linear 0.2s',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              gap: 12,
            }}
          >
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />
            <div style={{ height: 10, width: '55%', borderRadius: 4, background: 'rgba(255,255,255,0.04)' }} />
            <div style={{ height: 8, width: '15%', borderRadius: 4, background: 'rgba(255,255,255,0.02)', marginLeft: 'auto' }} />
          </div>

          {/* Skeleton Item 3 */}
          <div
            style={{
              height: 52,
              borderRadius: 14,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 75%)',
              backgroundSize: '200% 100%',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              animation: 'shimmer-flow 1.5s infinite linear 0.4s',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              gap: 12,
            }}
          >
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />
            <div style={{ height: 10, width: '30%', borderRadius: 4, background: 'rgba(255,255,255,0.04)' }} />
            <div style={{ height: 8, width: '25%', borderRadius: 4, background: 'rgba(255,255,255,0.02)', marginLeft: 'auto' }} />
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes icon-shine {
          0% { left: -150%; }
          50% { left: 150%; }
          100% { left: 150%; }
        }
        @keyframes shimmer-flow {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .spin-slow {
          animation: rotate-orbit 4s linear infinite;
        }
        @keyframes rotate-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
