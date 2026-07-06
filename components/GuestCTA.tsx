'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * GuestCTA — Sticky "Ready To Get Started?" conversion banner.
 *
 * Renders ONLY for unauthenticated visitors. Silently hides once
 * a session is detected, so it never appears to signed-in users.
 */
export default function GuestCTA() {
  const [isGuest, setIsGuest] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    // Check once on mount
    supabase.auth.getSession().then(({ data }) => {
      setIsGuest(!data.session);
    });

    // Listen for sign-in so the banner disappears immediately
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsGuest(!session);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Don't render until we know (avoids flash on hydration)
  if (isGuest === null || isGuest === false) return null;

  return (
    <>
      {/* Spacer so page content is not hidden behind the fixed bar */}
      <div style={{ height: '120px' }} aria-hidden="true" />

      <div
        id="guest-cta-banner"
        role="complementary"
        aria-label="Ready To Get Started?"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9000,
          background: 'linear-gradient(180deg, rgba(5,10,15,0.96) 0%, #050A0F 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(192,184,168,0.15)',
          padding: '18px 24px 22px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Headline */}
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-brand, Inter, sans-serif)',
            fontSize: '1.05rem',
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: '0.01em',
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          Ready To Get Started?
        </p>

        {/* Sub-copy */}
        <p
          style={{
            margin: 0,
            fontSize: '0.8rem',
            color: 'var(--silver, #A8B4C0)',
            textAlign: 'center',
            lineHeight: 1.5,
            maxWidth: 480,
          }}
        >
          Already Have An Account? Sign In To Browse Your Storefront With Wholesale Pricing.
        </p>

        {/* CTA Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <Link
            href="/login"
            id="guest-cta-sign-in"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 28px',
              borderRadius: '8px',
              background: 'var(--teal, #C0B8A8)',
              color: '#050A0F',
              fontWeight: 700,
              fontSize: '0.9rem',
              letterSpacing: '0.02em',
              textDecoration: 'none',
              transition: 'opacity 0.15s ease, transform 0.1s ease',
              whiteSpace: 'nowrap',
              minHeight: 42,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            Sign In
          </Link>

          <Link
            href="/signup"
            id="guest-cta-create-account"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 20px',
              borderRadius: '8px',
              background: 'transparent',
              border: '1px solid rgba(192,184,168,0.35)',
              color: 'var(--silver, #A8B4C0)',
              fontWeight: 600,
              fontSize: '0.85rem',
              letterSpacing: '0.02em',
              textDecoration: 'none',
              transition: 'border-color 0.15s ease, color 0.15s ease',
              whiteSpace: 'nowrap',
              minHeight: 42,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(192,184,168,0.7)';
              e.currentTarget.style.color = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(192,184,168,0.35)';
              e.currentTarget.style.color = 'var(--silver, #A8B4C0)';
            }}
          >
            Create Account
          </Link>
        </div>
      </div>
    </>
  );
}
