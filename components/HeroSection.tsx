'use client';

import Link from 'next/link';

export default function HeroSection() {
  return (
    <section className="hero-bg section" style={{
      // 100dvh (dynamic viewport) is iOS-Safari-safe - 100vh leaks behind
      // the URL bar and chrome, causing the section to extend past the
      // viewport and prevent reaching the next section.
      minHeight: 'calc(100dvh - 64px)',
      display: 'flex', alignItems: 'center',
      position: 'relative', overflow: 'hidden'
    }}>
      {/* Background orbit animation */}
      <div style={{
        position: 'absolute',
        top: '50%', right: '-10%',
        transform: 'translateY(-50%)',
        width: 600, height: 600,
        borderRadius: '50%',
        border: '1px solid rgba(192,184,168,0.08)',
        pointerEvents: 'none'
      }}>
        <div style={{
          position: 'absolute', inset: 40,
          borderRadius: '50%',
          border: '1px solid rgba(192,184,168,0.05)'
        }} />
        <div style={{
          position: 'absolute', inset: 100,
          borderRadius: '50%',
          border: '1px solid rgba(192,184,168,0.03)'
        }} />
      </div>

      <div className="container">
        <div style={{ maxWidth: 720 }}>
          {/* Tag */}
          <div style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span className="badge badge-teal" style={{ fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 3h12" />
                <path d="M9 3v6l-5 9a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-5-9V3" />
              </svg>
              Research Use Only
            </span>
            <span className="badge badge-silver" style={{ fontSize: '0.7rem' }}>
              Wholesale Distribution
            </span>
          </div>

          {/* Headline */}
          <h1 className="glow-teal animate-fade-up" style={{ 
            marginBottom: 'var(--space-6)',
            color: 'var(--white)'
          }}>
            Premium Research{' '}
            <span style={{ color: 'var(--teal)' }}>Peptides</span>{' '}
            For The Scientific Community
          </h1>

          {/* Subheadline */}
          <p className="animate-fade-up delay-100" style={{ 
            fontSize: '1.1rem', 
            maxWidth: 580, 
            marginBottom: 'var(--space-8)',
            color: 'var(--silver-light)'
          }}>
            Pep Nation Lab Connects Qualified Researchers With Pharmaceutical-Grade 
            Research Compounds. Wholesale Pricing, Agent Network, And Seamless 
            Fulfillment For Labs Across The Country.
          </p>

          {/* Warning notice */}
          <div style={{
            background: 'rgba(229,62,62,0.06)',
            border: '1px solid rgba(229,62,62,0.2)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-8)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p style={{ fontSize: '0.8rem', color: 'var(--silver)', margin: 0 }}>
              All Products Are <strong style={{ color: 'var(--red)' }}>Strictly For In Vitro Research Use Only</strong> - 
              Not For Human Or Animal Consumption. Qualified Researchers Only.
            </p>
          </div>

          {/* CTAs */}
          <div className="animate-fade-up delay-200" style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <Link href="/login" className="btn btn-primary btn-xl">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10 17 15 12 10 7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
              Sign In
            </Link>
            <Link href="/products" className="btn btn-secondary btn-xl">
              View Product Catalog
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>

          {/* Stats row */}
          <div className="animate-fade-up delay-300" style={{ 
            display: 'flex', gap: 'var(--space-8)', marginTop: 'var(--space-12)',
            paddingTop: 'var(--space-8)',
            borderTop: '1px solid rgba(255,255,255,0.06)'
          }}>
            {[
              { num: '50+', label: 'Research Compounds' },
              { num: '3', label: 'Agent Tier Levels' },
              { num: '100%', label: 'Wholesale Pricing' },
            ].map(({ num, label }) => (
              <div key={label}>
                <div style={{ 
                  fontFamily: 'var(--font-brand)', 
                  fontSize: '1.75rem', 
                  fontWeight: 800,
                  color: 'var(--teal)',
                  textShadow: '0 0 20px rgba(192,184,168,0.4)'
                }}>{num}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
