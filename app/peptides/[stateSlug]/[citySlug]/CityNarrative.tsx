/**
 * CityNarrative.tsx
 *
 * Deep long-form body copy rendered only on tier-1 city pages. Pulls
 * per-city-unique paragraphs from getCityNarrative (returns null for the
 * tier-2/tier-3 long tail, so this component renders nothing there). Pure
 * server component - no client interactivity.
 */

import type { City } from '@/lib/cities/cities-data';
import { getCityNarrative } from '@/lib/cities/city-narrative';

export default function CityNarrative({ city }: { city: City }) {
  const paragraphs = getCityNarrative(city);
  if (!paragraphs || paragraphs.length === 0) return null;

  return (
    <section
      aria-label={`Research-Grade Peptides In ${city.name} - Overview`}
      style={{ position: 'relative', padding: 'clamp(56px, 7vw, 96px) 0', borderTop: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden' }}
    >
      <div className="container" style={{ maxWidth: 860, margin: '0 auto', position: 'relative', zIndex: 2 }}>
        <h2 style={{ color: 'var(--white)', fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 'var(--space-5)' }}>
          Research-Grade Peptides In {city.name}, {city.stateAbbr}
        </h2>
        {paragraphs.map((p, i) => (
          <p key={i} style={{ fontSize: '0.98rem', color: 'var(--silver-light)', lineHeight: 1.85, marginBottom: 'var(--space-4)' }}>
            {p}
          </p>
        ))}
      </div>
    </section>
  );
}
