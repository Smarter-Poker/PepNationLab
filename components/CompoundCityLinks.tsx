'use client';

import Link from 'next/link';
import { CITIES } from '@/lib/cities/cities-data';

export default function CompoundCityLinks({ compoundName }: { compoundName: string }) {
  // Select top 12 tier 1 cities to display
  const topCities = CITIES.filter(c => c.tier === 1).slice(0, 12);

  return (
    <div style={{ marginTop: 'var(--space-6, 32px)', paddingTop: 'var(--space-6, 32px)', borderTop: '1px solid rgba(192,184,168,0.1)' }}>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--white)', marginBottom: 'var(--space-2, 8px)' }}>
        Local Supply for {compoundName}
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4, 16px)', lineHeight: 1.5 }}>
        Pep Nation Lab provides premium {compoundName} for research institutions and qualified researchers across the United States. View our priority delivery zones:
      </p>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2, 8px)' }}>
        {topCities.map(city => (
          <Link
            key={`${city.stateSlug}-${city.slug}`}
            href={`/peptides/${city.stateSlug}/${city.slug}`}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              background: 'rgba(192,184,168,0.05)',
              border: '1px solid rgba(192,184,168,0.15)',
              fontSize: '0.75rem',
              color: 'var(--silver)',
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'var(--teal)';
              e.currentTarget.style.color = 'var(--teal)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'rgba(192,184,168,0.15)';
              e.currentTarget.style.color = 'var(--silver)';
            }}
          >
            {city.name}, {city.stateAbbr}
          </Link>
        ))}
        <Link
          href="/peptides"
          style={{
            padding: '6px 14px',
            borderRadius: '999px',
            background: 'rgba(0,196,188,0.1)',
            border: '1px solid rgba(0,196,188,0.3)',
            fontSize: '0.75rem',
            color: 'var(--teal)',
            textDecoration: 'none',
            fontWeight: 600,
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(0,196,188,0.2)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(0,196,188,0.1)';
          }}
        >
          View All Locations &rarr;
        </Link>
      </div>
    </div>
  );
}
