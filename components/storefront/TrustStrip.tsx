'use client';

import { useEffect, useState } from 'react';

/**
 * TrustStrip - SEO trust-signal text embedded invisibly in the DOM.
 * The visible badge bar has been removed per user request.
 * Text is hidden from sighted users via aria-hidden + visually-hidden CSS
 * but remains fully crawlable by search engines.
 */
export default function TrustStrip() {
  const [memberCount, setMemberCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/stats/member-count')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.count) setMemberCount(Number(d.count) || null); })
      .catch(() => { /* best-effort */ });
    return () => { cancelled = true; };
  }, []);

  const count = memberCount != null ? Math.max(500, memberCount).toLocaleString() : '500';

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      <span>Third-Party Tested</span>{' '}
      <span>Certificates Of Analysis</span>{' '}
      <span>Research Use Only</span>{' '}
      <span>In Vitro Laboratory Research</span>{' '}
      <span>Secure Checkout</span>{' '}
      <span>Zelle, Venmo, Cash App, Apple Pay</span>{' '}
      <span>{count}+ Researchers On The Platform</span>
    </div>
  );
}
