'use client';

/**
 * R28 - HelpHint
 *
 * Small inline "Learn more" pill that deep-links to a specific FAQ answer
 * via the `#faq-<id>` hash. Mount next to any UI element where buyers
 * commonly get stuck so they can read the answer without leaving the page
 * they were on (the help page opens the matching item on mount).
 *
 * Usage:
 *
 *   import HelpHint from '@/components/help/HelpHint';
 *   <HelpHint faqId="order-stuck-in-approval" />
 *   <HelpHint faqId="upload-payment-proof" label="Payment Proof Help" />
 *
 * Tracking: every click fires a beacon to /api/analytics/faq-click. Failures
 * are silent so they never block navigation.
 *
 * R33: 'use client' moved above the JSDoc. Turbopack currently allows
 * directives after pure comments, but the wallet build failure earlier this
 * session showed an invisible BOM/CR sequence can sneak ahead of the
 * directive and break the build. Keeping the directive on physical line 1
 * removes any ambiguity about what the parser sees first.
 */

import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';

// Deep link to a specific FAQ answer; the help page reads the `#faq-<id>`
// hash on mount and expands the matching item.
function faqDeepLink(faqId: string): string {
  return `/account/help#faq-${faqId}`;
}

interface Props {
  faqId: string;
  label?: string;
  variant?: 'chip' | 'icon';
  source?: string;
}

export default function HelpHint({
  faqId,
  label = 'Learn More',
  variant = 'chip',
  source,
}: Props) {
  const href = faqDeepLink(faqId);

  function onClick() {
    try {
      const body = JSON.stringify({ faqId, source: source ?? null });
      const blob = new Blob([body], { type: 'application/json' });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/faq-click', blob);
      } else {
        fetch('/api/analytics/faq-click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      /* never block navigation on telemetry */
    }
  }

  if (variant === 'icon') {
    return (
      <Link
        href={href}
        onClick={onClick}
        aria-label={`Help: ${label}`}
        title={label}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: 999,
          background: 'rgba(0,196,188,0.10)',
          border: '1px solid rgba(0,196,188,0.30)',
          color: 'var(--teal)',
          textDecoration: 'none',
        }}
      >
        <LifeBuoy size={12} aria-hidden />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: '0.74rem',
        fontWeight: 600,
        color: 'var(--teal)',
        background: 'rgba(0,196,188,0.08)',
        border: '1px solid rgba(0,196,188,0.25)',
        borderRadius: 999,
        padding: '4px 10px',
        textDecoration: 'none',
        lineHeight: 1.2,
      }}
    >
      <LifeBuoy size={12} aria-hidden /> {label}
    </Link>
  );
}
