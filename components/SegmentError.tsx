'use client';

import { useEffect } from 'react';
import { captureError } from '@/lib/sentry';

/**
 * Shared segment-level error boundary body. Unlike app/error.tsx (which
 * replaces the entire viewport), this renders INSIDE the segment's layout,
 * so the navbar, cart, and the rest of the page chrome stay alive when a
 * single route segment fails (e.g. a Supabase timeout while fetching
 * monograph data or the Top 10 grid).
 */
export default function SegmentError({
  error,
  reset,
  boundary,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  boundary: string;
}) {
  useEffect(() => {
    console.error(`[${boundary}]`, error?.message, error?.stack);
    captureError(error, { boundary, digest: error?.digest });
  }, [error, boundary]);

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 1.5rem',
        minHeight: '40vh',
      }}
    >
      <div style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>
        <div
          style={{
            width: 52,
            height: 52,
            margin: '0 auto 1.25rem',
            borderRadius: '50%',
            background: 'rgba(229,62,62,0.12)',
            border: '2px solid rgba(229,62,62,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E53E3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h2 style={{ fontSize: '1.3rem', color: 'var(--white, #FFFFFF)', marginBottom: '0.6rem', fontWeight: 700 }}>
          This Section Could Not Load
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--silver, #A8B4C0)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
          The Rest Of The Site Is Still Available. Please Try Again.
        </p>
        {error?.digest ? (
          <p style={{ fontSize: '0.7rem', color: 'var(--grey-400, #6B7785)', marginBottom: '1.25rem', fontFamily: 'monospace', wordBreak: 'break-word', textTransform: 'none' }}>
            Reference: {error.digest}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => reset()}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.65rem 1.4rem', background: 'var(--teal, #00C4BC)', color: 'var(--black, #050A0F)', borderRadius: '0.5rem', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Try Again
          </button>
          <a
            href="/"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.65rem 1.4rem', background: 'transparent', color: 'var(--silver, #A8B4C0)', borderRadius: '0.5rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.12)', textDecoration: 'none', fontSize: '0.9rem' }}
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
