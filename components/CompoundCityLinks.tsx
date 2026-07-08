import Link from 'next/link';
import { CITIES, getStateName } from '@/lib/cities/cities-data';

/**
 * CompoundCityLinks — internal link bridge from a research monograph down to the
 * local-availability pages. Server component (zero client JS) so every link is
 * present in the initial HTML for search engines and non-JS AI crawlers.
 *
 * Strategy:
 *   1. State hubs, ranked by depth (city count). These are the highest-authority
 *      local pages; each one distributes equity to all of its city pages. This is
 *      the primary funnel and is data-driven, so adding a new state to
 *      cities-data.ts automatically surfaces it here — no code change for Phase 2.
 *   2. One marquee city per top state (highest population) for a direct,
 *      geographically diverse spread of city links.
 *
 * Copy is deliberately research-framed (supply / availability / documentation /
 * qualified researchers) and never uses transactional language, to stay aligned
 * with the platform's research-use-only positioning.
 */
export default function CompoundCityLinks({ compoundName }: { compoundName: string }) {
  // Group by state, then rank states by number of cities (depth).
  const grouped = new Map<string, typeof CITIES>();
  for (const c of CITIES) {
    const arr = grouped.get(c.stateSlug) ?? [];
    arr.push(c);
    grouped.set(c.stateSlug, arr);
  }

  const stateHubs = [...grouped.entries()]
    .map(([slug, cities]) => ({ slug, name: getStateName(slug), count: cities.length, cities }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // One marquee city (highest population) from each of the top six state hubs.
  const marquee = stateHubs
    .slice(0, 6)
    .map((h) => [...h.cities].sort((a, b) => b.population - a.population)[0])
    .filter(Boolean);

  if (stateHubs.length === 0) return null;

  return (
    <div style={{ marginTop: 'var(--space-6, 32px)', paddingTop: 'var(--space-6, 32px)', borderTop: '1px solid rgba(192,184,168,0.1)' }}>
      <style>{`
        .pnl-loc-pill {
          display: inline-flex;
          align-items: center;
          min-height: 40px;
          padding: 8px 16px;
          border-radius: 999px;
          font-size: 0.82rem;
          text-decoration: none;
          transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
        }
        .pnl-loc-pill--hub {
          background: rgba(0,196,188,0.08);
          border: 1px solid rgba(0,196,188,0.28);
          color: var(--teal);
          font-weight: 600;
        }
        .pnl-loc-pill--hub:hover { background: rgba(0,196,188,0.18); border-color: var(--teal); }
        .pnl-loc-pill--city {
          background: rgba(192,184,168,0.05);
          border: 1px solid rgba(192,184,168,0.15);
          color: var(--silver);
        }
        .pnl-loc-pill--city:hover { border-color: var(--teal); color: var(--teal); }
        .pnl-loc-count { opacity: 0.7; font-weight: 500; margin-left: 6px; }
      `}</style>

      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--white)', marginBottom: 'var(--space-2, 8px)' }}>
        Regional Research Availability
      </h3>
      <p style={{ fontSize: '0.9rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4, 16px)', lineHeight: 1.55 }}>
        Pep Nation Lab supplies research-grade {compoundName} to qualified researchers and scientific institutions
        nationwide. Browse verified availability and per-region documentation by state:
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-5, 24px)' }}>
        {stateHubs.map((hub) => (
          <Link key={hub.slug} href={`/peptides/${hub.slug}`} className="pnl-loc-pill pnl-loc-pill--hub">
            {hub.name}
            <span className="pnl-loc-count">{hub.count} Cities</span>
          </Link>
        ))}
      </div>

      {marquee.length > 0 && (
        <>
          <p style={{ fontSize: '0.8rem', color: 'var(--grey-500, #8894a0)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 'var(--space-2, 8px)' }}>
            Featured Research Hubs
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2, 8px)' }}>
            {marquee.map((city) => (
              <Link
                key={`${city.stateSlug}-${city.slug}`}
                href={`/peptides/${city.stateSlug}/${city.slug}`}
                className="pnl-loc-pill pnl-loc-pill--city"
              >
                {city.name}, {city.stateAbbr}
              </Link>
            ))}
            <Link href="/peptides" className="pnl-loc-pill pnl-loc-pill--hub">
              View All Locations &rarr;
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
