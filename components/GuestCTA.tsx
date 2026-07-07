'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/components/CartContext';

/**
 * GuestCTA - Sticky conversion banner for unauthenticated visitors.
 *
 * - Renders ONLY for unauthenticated visitors
 * - Auto-hides the moment a session is detected
 * - CART-AWARE: when the guest has items in their cart, the banner switches to
 *   a checkout-conversion message (create a free account to complete the order),
 *   leads with "Create Account", and routes signup/login straight to /checkout.
 *   The guest cart persists in localStorage through signup, so nothing is lost.
 * - Otherwise passes the current page URL as ?redirect= so the user returns to
 *   where they were after signing in or creating an account
 * - Has a session-level dismiss (×) so it's not permanently in-your-face
 * - Shows live member count as social proof when available
 */
export default function GuestCTA() {
  const { cartCount, cartSubtotal } = useCart();
  const [isGuest, setIsGuest] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [currentPath, setCurrentPath] = useState('/');

  useEffect(() => {
    // Capture current URL for redirect passthrough
    setCurrentPath(window.location.pathname + window.location.search);

    const supabase = createClient();

    // Check auth state once on mount
    supabase.auth.getSession().then(({ data }) => {
      setIsGuest(!data.session);
    });

    // Listen for sign-in so the banner disappears immediately
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsGuest(!session);
    });

    // Load social proof count (best-effort, non-blocking)
    fetch('/api/stats/member-count')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.count) setMemberCount(d.count); })
      .catch(() => {/* ignore */});

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Don't render until we know auth state (avoids hydration flash)
  if (isGuest === null || isGuest === false || dismissed) return null;

  // Cart-aware conversion mode: a guest with items is routed to checkout after
  // auth so they can complete the order they already started.
  const hasCart = cartCount > 0;
  const authTarget = hasCart ? '/checkout' : currentPath;
  const redirectParam = `?redirect=${encodeURIComponent(authTarget)}`;
  const loginHref = `/login${redirectParam}`;
  const signupHref = `/signup${redirectParam}`;

  const headline = hasCart ? 'Complete Your Order' : 'Ready To Get Started?';
  const subCopy = hasCart
    ? 'Create A Free Researcher Account To Check Out. Your Cart Is Saved.'
    : 'Already Have An Account? Sign In To Browse Your Storefront With Wholesale Pricing.';

  // Cart summary shown in conversion mode.
  const cartLabel = hasCart
    ? `${cartCount} Item${cartCount === 1 ? '' : 's'} In Your Cart • $${Number(cartSubtotal || 0).toFixed(2)}`
    : null;

  // Format member count with comma separator
  const countLabel = memberCount != null
    ? `Join ${memberCount.toLocaleString()}+ researchers already on the platform.`
    : null;

  return (
    <>
      {/* Bottom spacer so last content isn't hidden behind fixed bar */}
      <div style={{ height: '130px' }} aria-hidden="true" />

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
          background: 'linear-gradient(180deg, rgba(5,10,15,0.97) 0%, #050A0F 100%)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderTop: '1px solid rgba(192,184,168,0.18)',
          padding: '16px 40px 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.55)',
        }}
      >
        {/* Dismiss button */}
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          style={{
            position: 'absolute',
            top: 12,
            right: 16,
            background: 'none',
            border: 'none',
            color: 'rgba(168,180,192,0.5)',
            cursor: 'pointer',
            fontSize: '1.1rem',
            lineHeight: 1,
            padding: '4px 6px',
            borderRadius: 4,
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(168,180,192,1)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(168,180,192,0.5)'; }}
        >
          ×
        </button>

        {/* Headline */}
        <p style={{
          margin: 0,
          fontFamily: 'var(--font-brand, Inter, sans-serif)',
          fontSize: '1.05rem',
          fontWeight: 700,
          color: '#FFFFFF',
          letterSpacing: '0.01em',
          textAlign: 'center',
          lineHeight: 1.3,
        }}>
          {headline}
        </p>

        {/* Sub-copy */}
        <p style={{
          margin: 0,
          fontSize: '0.8rem',
          color: 'var(--silver, #A8B4C0)',
          textAlign: 'center',
          lineHeight: 1.5,
          maxWidth: 480,
        }}>
          {subCopy}
        </p>

        {/* Cart summary (conversion mode) */}
        {cartLabel && (
          <p style={{
            margin: 0,
            fontSize: '0.82rem',
            fontWeight: 700,
            color: 'var(--teal, #00C4BC)',
            textAlign: 'center',
            letterSpacing: '0.01em',
          }}>
            {cartLabel}
          </p>
        )}

        {/* Social proof */}
        {countLabel && (
          <p style={{
            margin: 0,
            fontSize: '0.72rem',
            color: 'rgba(168,180,192,0.55)',
            textAlign: 'center',
            letterSpacing: '0.01em',
          }}>
            {countLabel}
          </p>
        )}

        {/* CTA Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginTop: 2,
        }}>
          <Link
            href={hasCart ? signupHref : loginHref}
            id="guest-cta-primary"
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
              whiteSpace: 'nowrap',
              minHeight: 42,
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            {hasCart ? 'Create Account & Check Out' : 'Sign In'}
          </Link>

          <Link
            href={hasCart ? loginHref : signupHref}
            id="guest-cta-secondary"
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
              whiteSpace: 'nowrap',
              minHeight: 42,
              transition: 'border-color 0.15s ease, color 0.15s ease',
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
            {hasCart ? 'Sign In' : 'Create Account'}
          </Link>
        </div>
      </div>
    </>
  );
}
