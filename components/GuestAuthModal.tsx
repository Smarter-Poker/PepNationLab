'use client';

import { useEffect } from 'react';

/**
 * GuestAuthModal - slide-up modal that prompts unauthenticated visitors
 * to sign in or create an account when they click a personalization button
 * (Save, Reading Queue, Subscribe, etc.).
 *
 * Usage:
 *   const [showGuestModal, setShowGuestModal] = useState(false);
 *   <GuestAuthModal open={showGuestModal} onClose={() => setShowGuestModal(false)} featureLabel="Save Compounds" />
 *
 * The modal passes the current page as ?redirect= so users return after auth.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  /** Short label describing what the guest tried to do, e.g. "Save Compounds" */
  featureLabel?: string;
}

export default function GuestAuthModal({ open, onClose, featureLabel = 'This Feature' }: Props) {
  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const currentPath = typeof window !== 'undefined'
    ? window.location.pathname + window.location.search
    : '/';
  const redirectParam = encodeURIComponent(currentPath);
  const loginHref = `/login?redirect=${redirectParam}`;
  const signupHref = `/signup?redirect=${redirectParam}`;

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
            padding: '4px 8px',
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
          margin: '0 0 24px',
          fontSize: '0.83rem',
          color: 'var(--silver, #A8B4C0)',
          textAlign: 'center',
          lineHeight: 1.6,
        }}>
          Create a free account to save compounds, build reading queues, subscribe
          to research updates, and browse your agent&apos;s storefront with wholesale pricing.
        </p>

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
            }}
          >
            Create Free Account
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
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translate(-50%, calc(-50% + 20px)) } to { opacity: 1; transform: translate(-50%, -50%) } }
      `}</style>
    </>
  );
}
