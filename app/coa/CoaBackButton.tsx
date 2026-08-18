'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * A client-side "← Back" button for the COA pages.
 *
 * Uses router.back() so the researcher returns to wherever they came from
 * (product page, storefront, order history, etc.).
 *
 * MOBILE DEAD-END FIX: router.back() alone is a trap when there is no history
 * to go back to - a COA opened from a QR code on a vial, a shared link, a new
 * tab, or a PWA cold start all land here with an empty history stack, and the
 * button silently did nothing. That is the "stuck on the COA page, have to
 * close out" report. We now detect that case up front and render a real
 * forward link to `fallbackHref` instead, so there is ALWAYS a way out.
 */
export default function CoaBackButton({
  fallbackHref = '/',
  label = 'Back',
  fallbackLabel,
}: {
  fallbackHref?: string;
  label?: string;
  fallbackLabel?: string;
}) {
  const router = useRouter();
  // Assume history exists until the client proves otherwise (avoids a flash of
  // the wrong label during hydration).
  const [canGoBack, setCanGoBack] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // history.length === 1 means this tab has nowhere to go back to. Also
    // treat "no referrer AND a single entry" as a cold start (QR scan, shared
    // link, PWA launch).
    const hasHistory = window.history.length > 1;
    setCanGoBack(hasHistory);
  }, []);

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: 'transparent',
    border: 'none',
    // 44px min tap target - the old 0.4rem vertical padding was well under
    // the accessible minimum on a phone.
    padding: '0.65rem 0.25rem',
    minHeight: 44,
    cursor: 'pointer',
    color: '#A8B4C0',
    fontSize: '0.95rem',
    fontWeight: 600,
    lineHeight: 1,
    textDecoration: 'none',
    transition: 'color 0.15s',
  };

  const chevron = (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );

  if (!canGoBack) {
    return (
      <a href={fallbackHref} aria-label={fallbackLabel || 'Go to Pep Nation Lab'} style={style}>
        {chevron}
        {fallbackLabel || 'Pep Nation Lab'}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Go back to previous page"
      style={style}
      onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = '#FFFFFF')}
      onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = '#A8B4C0')}
    >
      {chevron}
      {label}
    </button>
  );
}
