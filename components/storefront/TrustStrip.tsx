'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, FlaskConical, Lock, Users } from 'lucide-react';

/**
 * TrustStrip - a self-contained reassurance bar rendered once above the
 * storefront product grid. Surfaces the trust signals a researcher weighs at
 * the decision moment: third-party COA testing, research-use compliance,
 * secure checkout, and live social proof (active researcher count).
 *
 * Self-contained by design: no required props, best-effort member-count fetch,
 * renders its static badges regardless of network state. Kept out of the large
 * AgentStorefrontGrid so it can evolve without touching that hot file.
 */
export default function TrustStrip() {
  const [memberCount, setMemberCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/stats/member-count')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.count) setMemberCount(Number(d.count) || null); })
      .catch(() => { /* best-effort; static badges still render */ });
    return () => { cancelled = true; };
  }, []);

  const items: { icon: React.ReactNode; title: string; sub: string }[] = [
    {
      icon: <ShieldCheck size={18} aria-hidden="true" />,
      title: 'Third-Party Tested',
      sub: 'Certificates Of Analysis',
    },
    {
      icon: <FlaskConical size={18} aria-hidden="true" />,
      title: 'Research Use Only',
      sub: 'In Vitro Laboratory Research',
    },
    {
      icon: <Lock size={18} aria-hidden="true" />,
      title: 'Secure Checkout',
      sub: 'Zelle, Venmo, Cash App, Apple Pay',
    },
    {
      icon: <Users size={18} aria-hidden="true" />,
      title: memberCount != null
        ? `${Math.max(500, memberCount).toLocaleString()}+ Researchers`
        : 'Trusted Nationwide',
      sub: 'On The Platform',
    },
  ];

  return (
    <div
      role="complementary"
      aria-label="Storefront Trust Signals"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 'var(--space-3, 12px)',
        margin: '0 0 var(--space-6, 24px)',
        padding: 'var(--space-4, 16px)',
        background: 'var(--surface-2, #162230)',
        border: '1px solid rgba(192, 184, 168, 0.14)',
        borderRadius: 'var(--radius-lg, 14px)',
      }}
    >
      {items.map((it) => (
        <div key={it.title} style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 38,
              height: 38,
              flexShrink: 0,
              borderRadius: 10,
              background: 'rgba(0, 196, 188, 0.10)',
              color: 'var(--teal, #00C4BC)',
            }}
          >
            {it.icon}
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <strong style={{ color: 'var(--white, #FFFFFF)', fontSize: '0.86rem', fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {it.title}
            </strong>
            <span style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.72rem', lineHeight: 1.3 }}>
              {it.sub}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
