'use client';

import { useEffect } from 'react';
import { captureError } from '@/lib/sentry';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, { boundary: 'app/global-error.tsx', digest: error?.digest });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif", background: '#050A0F', color: '#FFFFFF' }}>
        <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'radial-gradient(ellipse at 50% 0%, rgba(229,62,62,0.06) 0%, transparent 60%), #050A0F' }}>
          <div style={{ width: '100%', maxWidth: 560, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, margin: '0 auto 1.5rem', borderRadius: '50%', background: 'rgba(229,62,62,0.12)', border: '2px solid rgba(229,62,62,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E53E3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h1 style={{ fontSize: '1.6rem', color: '#FFFFFF', marginBottom: '0.75rem', fontWeight: 700 }}>A Critical Error Occurred</h1>
            <p style={{ fontSize: '0.95rem', color: '#A8B4C0', marginBottom: '2rem', lineHeight: 1.6 }}>The Application Encountered A Fatal Error. Please Reload The Page Or Contact Support.</p>
            <button onClick={() => reset()} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem 1.5rem', background: 'linear-gradient(180deg, #DCD3C3 0%, #B3A992 100%)', color: '#050A0F', borderRadius: '0.5rem', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '0.95rem' }}>Try Again</button>
          </div>
        </div>
      </body>
    </html>
  );
}
