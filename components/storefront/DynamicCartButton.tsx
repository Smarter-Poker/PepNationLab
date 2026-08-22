'use client';

import Image from 'next/image';
import React from 'react';
import { createClient } from '@/lib/supabase/client';
import GuestAuthModal from '@/components/GuestAuthModal';

interface DynamicCartButtonProps {
  type: 'checkout' | 'shopping' | 'clear';
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  /**
   * Set false to opt a checkout button out of the guest signup checkpoint
   * (e.g. an internal admin flow). Defaults on: every checkout surface in the
   * app renders through this component, so the gate lives here rather than
   * being re-implemented -- and re-forgotten -- at each call site.
   */
  guestGate?: boolean;
}

export default function DynamicCartButton({
  type,
  onClick,
  disabled = false,
  style = {},
  className = '',
  guestGate = true,
}: DynamicCartButtonProps) {
  const [isPressed, setIsPressed] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  // --- SIGNUP CHECKPOINT: CHECKOUT ---
  //
  // WHY HERE. Checkout is reached from two places -- the storefront grid's
  // floating cart and the global cart drawer -- and both render this exact
  // component. Gating here covers both and cannot drift out of sync.
  //
  // WHY ONLY CHECKOUT. A guest is never asked for an account to LOOK at
  // anything: storefront browsing, pricing, product detail, search and COA
  // lookup all stay open (see the access-model note at the top of proxy.ts).
  // The ask happens at commitment, and placing an order is the commitment.
  //
  // WHY NOTHING IS LOST. Both carts are already written to localStorage on
  // every change -- `pnl_storefront_cart_<slug>` + `cart_<slug>` from the grid,
  // `pnl_cart` from the drawer -- so intercepting the tap discards no state.
  // The modal returns the visitor to THIS page after auth (rather than jumping
  // straight to /checkout) precisely so the cart is rehydrated by the same code
  // that built it, and so storefront-specific rules that run in the original
  // handler -- order minimums in particular -- still get their say.
  //
  // WHAT THIS REPLACES. Before, a logged-out tap called router.push('/checkout')
  // and the middleware answered: a QR-locked guest was bounced silently back to
  // the storefront with no explanation at all, and an unlocked one landed on a
  // bare /login wall. Neither told them what happened or why.
  const isCheckout = type === 'checkout' && guestGate;
  const [isGuest, setIsGuest] = React.useState(false);
  const [showGate, setShowGate] = React.useState(false);

  React.useEffect(() => {
    if (!isCheckout) return;
    let active = true;
    const supabase = createClient();
    // Defaults to false and only ever flips on a resolved answer, so a signed-in
    // shopper cannot be shown the gate during the session round-trip.
    supabase.auth.getSession().then(({ data }) => {
      if (active) setIsGuest(!data.session);
    }).catch(() => { /* leave as not-guest; the middleware is still the guard */ });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setIsGuest(!session);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [isCheckout]);

  // Aspect ratio is 805 / 96 = ~8.385
  const imageSrc = {
    checkout: '/images/checkout-btn.png',
    shopping: '/images/shopping-btn.png',
    clear: '/images/clear-btn.png',
  }[type];

  const altText = {
    checkout: 'Go To Checkout',
    shopping: 'Keep Shopping',
    clear: 'Clear Cart',
  }[type];

  // Glow shadow colors matching button themes
  const glowColor = {
    checkout: 'rgba(0, 229, 255, 0.25)',
    shopping: 'rgba(255, 255, 255, 0.15)',
    clear: 'rgba(229, 62, 62, 0.25)',
  }[type];

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          if (disabled) return;
          if (isCheckout && isGuest) {
            setShowGate(true);
            return;
          }
          onClick(e);
        }}
        disabled={disabled}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => {
          setIsPressed(false);
          setIsHovered(false);
        }}
        onMouseEnter={() => setIsHovered(true)}
        className={className}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          outline: 'none',
          width: '100%',
          aspectRatio: '805 / 96',
          opacity: disabled ? 0.45 : 1,
          transform: isPressed ? 'scale(0.97)' : isHovered ? 'scale(1.01)' : 'scale(1)',
          filter: isHovered && !disabled
            ? `brightness(1.08) drop-shadow(0 4px 12px ${glowColor})`
            : 'none',
          transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), filter 0.2s ease, opacity 0.2s',
          flexShrink: 0,
          ...style,
        }}
      >
        <Image
          src={imageSrc}
          alt={altText}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
         width={200} height={200} unoptimized />
      </button>

      {isCheckout && (
        <GuestAuthModal
          open={showGate}
          onClose={() => setShowGate(false)}
          featureLabel="Checkout"
          description="Your cart is saved. Create a free account to place this order, get shipping updates, and reorder in one tap."
          ctaLabel="Create Account & Check Out"
        />
      )}
    </>
  );
}
