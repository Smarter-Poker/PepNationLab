'use client';

import { useEffect } from 'react';
import { captureError } from '@/lib/sentry';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, { boundary: 'app/error.tsx', digest: error?.digest });
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--black, #050A0F)',
        padding: '2rem',
      }}
    >
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(229,62,62,0.05) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 560,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            margin: '0 auto 1.5rem',
            borderRadius: '50%',
            background: 'rgba(229,62,62,0.12)',
            border: '2px solid rgba(229,62,62,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E53E3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1 style={{ fontSize: '1.6rem', color: 'var(--white, #FFFFFF)', marginBottom: '0.75rem', fontWeight: 700 }}>Something Went Wrong</h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--silver, #A8B4C0)', marginBottom: '1.5rem', lineHeight: 1.6 }}>An Unexpected Error Occurred. Please Try Again Or Contact Support If The Problem Persists.</p>
        {error?.message ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--grey-400, #6B7785)', marginBottom: '2rem', fontFamily: 'monospace', wordBreak: 'break-word', textTransform: 'none' }}>{error.message}</p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => reset()} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem 1.5rem', background: 'var(--teal, #00C4BC)', color: 'var(--black, #050A0F)', borderRadius: '0.5rem', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '0.95rem' }}>Try Again</button>
          <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem 1.5rem', background: 'transparent', color: 'var(--silver, #A8B4C0)', borderRadius: '0.5rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.12)', textDecoration: 'none', fontSize: '0.95rem' }}>Return To Login</a>
        </div>
      </div>
    </div>
  );
}
