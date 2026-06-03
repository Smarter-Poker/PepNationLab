'use client';

/**
 * BrowseSurfaceNav -- pill strip linking to the seven new browse surfaces.
 * Rendered on /research home and as an "Explore More" rail on monograph pages.
 */

import Link from 'next/link';
import {
  ListOrdered,
  Calendar,
  Award,
  BookOpen,
  ShieldAlert,
  FlaskConical,
  Sparkles,
} from 'lucide-react';

const SURFACES: Array<{ href: string; label: string; Icon: typeof ListOrdered }> = [
  { href: '/research/a-z', label: 'A To Z Index', Icon: ListOrdered },
  { href: '/research/timeline', label: 'Discovery Timeline', Icon: Calendar },
  { href: '/research/most-cited', label: 'Most Cited', Icon: Award },
  { href: '/research/new-additions', label: 'New Additions', Icon: Sparkles },
  { href: '/research/wada-prohibited', label: 'WADA Prohibited', Icon: ShieldAlert },
  { href: '/research/approved-drugs', label: 'Approved Drugs', Icon: BookOpen },
  { href: '/research/calculators', label: 'Calculators', Icon: FlaskConical },
];

export default function BrowseSurfaceNav({ compact = false }: { compact?: boolean }) {
  return (
    <nav
      aria-label="Browse Research Surfaces"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: compact ? '12px 0' : '20px 0',
      }}
    >
      {SURFACES.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: '#D0DAE4',
            background: 'rgba(15,25,35,0.6)',
            border: '1px solid rgba(168,180,192,0.25)',
            padding: '6px 14px',
            borderRadius: 999,
            textDecoration: 'none',
            transition: 'all 0.15s',
          }}
        >
          <Icon size={14} color="#00C4BC" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
