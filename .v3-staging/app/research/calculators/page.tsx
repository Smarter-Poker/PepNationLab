/**
 * /research/calculators -- six researcher calculators, each anchored for direct
 * linking from InstantAnswerCard CTAs. Server-component shell, client-side
 * <CalculatorSuite /> for the interactive math.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import GlobalSearchBar from '@/components/research/GlobalSearchBar';
import BrowseSurfaceNav from '@/components/research/BrowseSurfaceNav';
import CalculatorSuite from '@/components/research/CalculatorSuite';

export const metadata: Metadata = {
  title: 'Researcher Calculators | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

const ANCHORS: Array<{ href: string; label: string }> = [
  { href: '#reconstitution', label: 'Reconstitution' },
  { href: '#dilution', label: 'Serial Dilution' },
  { href: '#concentration', label: 'Concentration Converter' },
  { href: '#stability', label: 'Arrhenius Stability' },
  { href: '#cost', label: 'Cost Per Dose' },
  { href: '#pooling', label: 'Vial Pooling' },
];

export default function CalculatorsPage() {
  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 16px 64px' }}>
      <nav style={{ marginBottom: 16 }}>
        <Link href="/research" style={{ color: '#00C4BC', fontSize: 13, textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
          Researcher Calculators
        </h1>
        <p style={{ color: '#A8B4C0', fontSize: 16, marginTop: 8, maxWidth: 700, lineHeight: 1.6 }}>
          Pure Lab-Prep Math, Built For The Bench. Reconstitution, Concentration Conversion, Serial
          Dilution, Arrhenius Stability, Cost Per Dose, And Multi-Vial Pooling. Research Use Only.
        </p>
      </header>

      <div style={{ marginBottom: 20 }}>
        <GlobalSearchBar compact />
      </div>

      <nav aria-label="Jump To Calculator" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
        {ANCHORS.map((a) => (
          <a
            key={a.href}
            href={a.href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: '#00C4BC',
              border: '1px solid rgba(0,196,188,0.4)',
              background: 'rgba(0,196,188,0.08)',
              padding: '5px 12px',
              borderRadius: 999,
              textDecoration: 'none',
            }}
          >
            {a.label}
          </a>
        ))}
      </nav>

      <CalculatorSuite />

      <BrowseSurfaceNav />
    </div>
  );
}
