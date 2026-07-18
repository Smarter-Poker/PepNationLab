'use client';

import { useRouter } from 'next/navigation';

/**
 * A client-side "← Back" button for the COA lookup page.
 * Uses router.back() so the researcher returns to wherever they came from
 * (product page, storefront, order history, etc.).
 * Falls back to the home page if there is no navigation history.
 */
export default function CoaBackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Go back to previous page"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        background: 'transparent',
        border: 'none',
        padding: '0.4rem 0',
        cursor: 'pointer',
        color: '#A8B4C0',
        fontSize: '0.9rem',
        fontWeight: 500,
        lineHeight: 1,
        transition: 'color 0.15s',
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = '#FFFFFF')}
      onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = '#A8B4C0')}
    >
      {/* Left-pointing chevron */}
      <svg
        width="16"
        height="16"
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
      Back
    </button>
  );
}
