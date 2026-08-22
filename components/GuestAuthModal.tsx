'use client';

import { useEffect, useState } from 'react';
import { useModalA11y } from '@/lib/useModalA11y';

/**
 * GuestAuthModal - the signup CHECKPOINT surface.
 *
 * A logged-out visitor is never asked for an account to LOOK at anything:
 * browsing a storefront, reading product detail and seeing pricing are all
 * open by design (see the guest-storefront rule in proxy.ts). The account ask
 * happens only at a COMMITMENT action -- checking out, saving something to an
 * account, subscribing to an alert -- and it happens here.
 *
 * Usage:
 *   const [showGuestModal, setShowGuestModal] = useState(false);
 *   <GuestAuthModal
 *     open={showGuestModal}
 *     onClose={() => setShowGuestModal(false)}
 *     featureLabel="Checkout"
 *     description="Your cart is saved..."
 *     redirectTo="/checkout?agent=savagebrands"
 *     ctaLabel="Create Account & Check Out"
 *   />
 *
 * ATTRIBUTION: the sign-up links here carry ONLY ?redirect=. They must never
 * carry ?ref= -- proxy.ts reroutes any account-entry GET that carries a ref
 * code back to the locked storefront, so a ?ref= link here would bounce the
 * visitor away from the very form they just asked for. Referral credit rides
 * the httpOnly signed `pnl_ref_lock` cookie and needs no URL parameter.
 */

const AGENT_STORAGE_KEY = 'pnl_referral_agent';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Short label describing what the guest tried to do, e.g. "Checkout" */
  featureLabel?: string;
  /** Context-specific reassurance copy. Falls back to the generic pitch. */
  description?: string;
  /** Where to land after auth. Defaults to the current URL. */
  redirectTo?: string;
  /** Primary button label. */
  ctaLabel?: string;
}

export default function GuestAuthModal({
  open,
  onClose,
  featureLabel = 'This Feature',
  description,
  redirectTo,
  ctaLabel,
}: Props) {
  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Which storefront this visitor is attributed to, purely for reassurance
  // copy. Read on open (not at module scope) because localStorage does not
  // exist during SSR and the lock can be minted after first paint.
  const [agentSlug, setAgentSlug] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    try {
      const raw = window.localStorage.getItem(AGENT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { slug?: string };
      if (parsed && typeof parsed.slug === 'string' && parsed.slug) {
        setAgentSlug(parsed.slug);
      }
    } catch {
      /* private mode / malformed payload -- reassurance line is optional */
    }
  }, [open]);

  // A11y: initial focus, Tab trap, Escape-to-close, focus restore
  const dialogRef = useModalA11y<HTMLDivElement>(open, { onClose });

  if (!open) return null;

  const currentPath = typeof window !== 'undefined'
    ? window.location.pathname + window.location.search
    : '/';
  // Only ever a same-origin relative path; never an absolute URL.
  const target = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')
    ? redirectTo
    : currentPath;
  const redirectParam = encodeURIComponent(target);
  const loginHref = `/login?redirect=${redirectParam}`;
  const signupHref = `/signup?redirect=${redirectParam}`;

  const body = description
    || 'Create a free account to save compounds, build reading queues, subscribe '
     + "to research updates, and browse your agent's storefront with wholesale pricing.";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 98000,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.18s ease',
        }}
      />

      {/* Modal sheet */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Sign in to use ${featureLabel}`}
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 99000,
          width: '100%',
          maxWidth: 440,
          background: 'linear-gradient(160deg, #0D1117 0%, #080C12 100%)',
          border: '1px solid rgba(192,184,168,0.18)',
          borderRadius: 20,
          padding: '36px 32px 32px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          animation: 'slideUp 0.22s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            color: 'rgba(168,180,192,0.5)',
            cursor: 'pointer',
            fontSize: '1.2rem',
            lineHeight: 1,
            padding: '8px 10px',
            minWidth: 24,
            minHeight: 24,
            borderRadius: 4,
          }}
        >
          ×
        </button>

        {/* Lock icon */}
        <div style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'rgba(192,184,168,0.1)',
          border: '1px solid rgba(192,184,168,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--teal,#C0B8A8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h2 style={{
          margin: '0 0 8px',
          fontSize: '1.15rem',
          fontWeight: 700,
          color: '#FFFFFF',
          textAlign: 'center',
          lineHeight: 1.3,
        }}>
          {featureLabel} Requires An Account
        </h2>

        <p style={{
          margin: '0 0 16px',
          fontSize: '0.83rem',
          color: 'var(--silver, #A8B4C0)',
          textAlign: 'center',
          lineHeight: 1.6,
        }}>
          {body}
        </p>

        {/* Attribution reassurance: the visitor stays with the storefront they
            came in through. This is the question a scanned guest actually has. */}
        {agentSlug && (
          <p style={{
            margin: '0 0 20px',
            fontSize: '0.76rem',
            color: 'rgba(168,180,192,0.72)',
            textAlign: 'center',
            lineHeight: 1.55,
            padding: '9px 12px',
            borderRadius: 10,
            background: 'rgba(192,184,168,0.06)',
            border: '1px solid rgba(192,184,168,0.14)',
          }}>
            You&apos;ll stay linked to <strong style={{ color: 'var(--teal, #C0B8A8)' }}>/{agentSlug}</strong> —
            {' '}your account is credited to them automatically.
          </p>
        )}
        {!agentSlug && <div style={{ height: 8 }} />}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a
            href={signupHref}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '13px 24px',
              borderRadius: 10,
              background: 'var(--teal, #C0B8A8)',
              color: '#050A0F',
              fontWeight: 700,
              fontSize: '0.95rem',
              textDecoration: 'none',
              letterSpacing: '0.01em',
              textAlign: 'center',
            }}
          >
            {ctaLabel || 'Create Free Account'}
          </a>
          <a
            href={loginHref}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 24px',
              borderRadius: 10,
              background: 'transparent',
              border: '1px solid rgba(192,184,168,0.3)',
              color: 'var(--silver, #A8B4C0)',
              fontWeight: 600,
              fontSize: '0.88rem',
              textDecoration: 'none',
            }}
          >
            Already Have An Account? Sign In
          </a>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(168,180,192,0.55)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 0 0',
              textDecoration: 'underline',
              textUnderlineOffset: 2,
            }}
          >
            Keep Browsing As A Guest
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translate(-50%, calc(-50% + 20px)) } to { opacity: 1; transform: translate(-50%, -50%) } }
      `}</style>
    </>
  );
}
