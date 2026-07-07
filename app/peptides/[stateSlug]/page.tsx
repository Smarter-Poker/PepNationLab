import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CITIES, getStatesSlugs, getCitiesByState, getStateName } from '@/lib/cities/cities-data';

// ─── Static params ─────────────────────────────────────────────────────────
export async function generateStaticParams() {
  return getStatesSlugs().map((stateSlug) => ({ stateSlug }));
}

// ─── Per-state metadata ────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ stateSlug: string }>;
}): Promise<Metadata> {
  const { stateSlug } = await params;
  const cities = getCitiesByState(stateSlug);
  if (cities.length === 0) return {};

  const stateName = getStateName(stateSlug);
  const stateAbbr = cities[0].stateAbbr;
  const title = `Research Peptides In ${stateName} | ${cities.length} Cities | Pep Nation Lab`;
  const description = `Pep Nation Lab supplies research-grade peptides to qualified researchers across ${cities.length} cities in ${stateName}. BPC-157, Semaglutide, Tirzepatide, TB-500 and 300+ more. Wholesale pricing. Verified accounts only.`;

  return {
    title,
    description,
    alternates: { canonical: `https://pepnationlab.com/peptides/${stateSlug}` },
    openGraph: {
      title,
      description,
      url: `https://pepnationlab.com/peptides/${stateSlug}`,
      type: 'website',
      images: [{ url: '/og-card.png', width: 1200, height: 630, alt: `Research Peptides in ${stateName}` }],
    },
    robots: { index: true, follow: true },
  };
}

// ─── Page component ────────────────────────────────────────────────────────
export default async function StateLandingPage({
  params,
}: {
  params: Promise<{ stateSlug: string }>;
}) {
  const { stateSlug } = await params;
  const cities = getCitiesByState(stateSlug);
  if (cities.length === 0) notFound();

  const stateName = getStateName(stateSlug);
  const stateAbbr = cities[0].stateAbbr;

  // Sort: Tier 1 first, then by population desc within each tier
  const sorted = [...cities].sort((a, b) => a.tier - b.tier || b.population - a.population);

  const tier1 = sorted.filter((c) => c.tier === 1);
  const tier2 = sorted.filter((c) => c.tier === 2);
  const tier3 = sorted.filter((c) => c.tier === 3);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
          { '@type': 'ListItem', position: 2, name: 'Peptides By City', item: 'https://pepnationlab.com/peptides' },
          { '@type': 'ListItem', position: 3, name: stateName, item: `https://pepnationlab.com/peptides/${stateSlug}` },
        ],
      },
      {
        '@type': 'CollectionPage',
        name: `Research Peptides In ${stateName}`,
        url: `https://pepnationlab.com/peptides/${stateSlug}`,
        description: `Research-grade peptide coverage across ${cities.length} cities in ${stateName}.`,
        publisher: { '@type': 'Organization', name: 'Pep Nation Lab', url: 'https://pepnationlab.com' },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div style={{ background: 'var(--black)', minHeight: '100dvh' }}>

        {/* ── HERO ─────────────────────────────────────────────────── */}
        <section
          className="hero-bg"
          style={{
            position: 'relative',
            overflow: 'hidden',
            paddingTop: 'clamp(80px, 12vw, 140px)',
            paddingBottom: 'clamp(60px, 8vw, 100px)',
          }}
        >
          <div className="container" style={{ position: 'relative', zIndex: 1 }}>

            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" style={{ marginBottom: 'var(--space-6)' }}>
              <ol style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', listStyle: 'none', padding: 0, margin: 0 }}>
                {[
                  { label: 'Home', href: '/' },
                  { label: 'Peptides By City', href: '/peptides' },
                  { label: stateName, href: null },
                ].map((crumb, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {i > 0 && <span style={{ color: 'var(--grey-600)', fontSize: '0.7rem' }}>›</span>}
                    {crumb.href ? (
                      <Link href={crumb.href} style={{ fontSize: '0.8rem', color: 'var(--grey-400)' }}>
                        {crumb.label}
                      </Link>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--teal)' }}>{crumb.label}</span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
              <span className="badge badge-teal" style={{ fontSize: '0.68rem' }}>Research Use Only</span>
              <span className="badge badge-silver" style={{ fontSize: '0.68rem' }}>{stateAbbr} — {cities.length} Cities</span>
              {tier1.length > 0 && (
                <span className="badge" style={{ fontSize: '0.68rem', background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.25)', color: 'var(--gold)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  {tier1.length} Priority {tier1.length === 1 ? 'Market' : 'Markets'}
                </span>
              )}
            </div>

            <h1 className="glow-teal" style={{ color: 'var(--white)', maxWidth: 700, marginBottom: 'var(--space-5)' }}>
              Research Peptides In{' '}
              <span style={{ color: 'var(--teal)' }}>{stateName}</span>
            </h1>

            <p style={{ fontSize: '1.05rem', maxWidth: 620, color: 'var(--silver-light)', lineHeight: 1.75, marginBottom: 'var(--space-7)' }}>
              Pep Nation Lab serves qualified researchers across{' '}
              <strong style={{ color: 'var(--white)' }}>{cities.length} cities in {stateName}</strong>. Select your city
              for local peptide research coverage, wholesale pricing, and nearby agent support.
            </p>

            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <Link href="/login" className="btn btn-primary btn-xl">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                Access the Lab
              </Link>
              <Link href="/research" className="btn btn-secondary btn-xl">
                Browse Research Library
              </Link>
            </div>
          </div>
        </section>

        {/* ── CITY GRID ─────────────────────────────────────────────── */}
        <section className="section" style={{ paddingTop: 'var(--space-20)', paddingBottom: 'var(--space-20)' }}>
          <div className="container">

            {/* Tier 1 */}
            {tier1.length > 0 && (
              <div style={{ marginBottom: 'var(--space-14)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--gold)" stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  <h2 style={{ color: 'var(--white)', fontSize: '1.1rem', margin: 0 }}>Priority Markets</h2>
                  <span style={{ fontSize: '0.7rem', color: 'var(--grey-600)', fontWeight: 400 }}>Highest tier — fastest fulfillment</span>
                </div>
                <CityGrid cities={tier1} stateSlug={stateSlug} highlight />
              </div>
            )}

            {/* Tier 2 */}
            {tier2.length > 0 && (
              <div style={{ marginBottom: 'var(--space-14)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--teal)' }} />
                  <h2 style={{ color: 'var(--white)', fontSize: '1.1rem', margin: 0 }}>Standard Markets</h2>
                </div>
                <CityGrid cities={tier2} stateSlug={stateSlug} />
              </div>
            )}

            {/* Tier 3 */}
            {tier3.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--grey-600)' }} />
                  <h2 style={{ color: 'var(--white)', fontSize: '1.1rem', margin: 0 }}>Extended Coverage</h2>
                </div>
                <CityGrid cities={tier3} stateSlug={stateSlug} />
              </div>
            )}

          </div>
        </section>

        {/* ── BACK LINK ─────────────────────────────────────────────── */}
        <div style={{ borderTop: 'var(--border-subtle)', padding: 'var(--space-8) 0', background: 'var(--black-2)' }}>
          <div className="container">
            <Link href="/peptides" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--grey-400)', textDecoration: 'none' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
              All States
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer style={{ background: 'var(--black)', borderTop: '1px solid rgba(192,184,168,0.06)', padding: 'var(--space-6) 0' }}>
          <div className="container" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              {[
                { label: 'Home', href: '/' },
                { label: 'Research Library', href: '/research' },
                { label: 'Disclaimer', href: '/disclaimer' },
                { label: 'Privacy', href: '/privacy' },
                { label: 'Terms', href: '/terms' },
              ].map(({ label, href }) => (
                <Link key={label} href={href} style={{ fontSize: '0.78rem', color: 'var(--grey-600)', textDecoration: 'none' }}>
                  {label}
                </Link>
              ))}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--grey-600)', margin: 0 }}>
              {new Date().getFullYear()} Pep Nation Lab LLC. All Rights Reserved.
            </p>
          </div>
        </footer>

      </div>
    </>
  );
}

// ─── City card grid component ──────────────────────────────────────────────
import type { City } from '@/lib/cities/cities-data';

function CityGrid({ cities, stateSlug, highlight = false }: { cities: City[]; stateSlug: string; highlight?: boolean }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: 'var(--space-3)',
    }}>
      {cities.map((city) => (
        <Link
          key={city.slug}
          href={`/peptides/${stateSlug}/${city.slug}`}
          style={{ textDecoration: 'none' }}
        >
          <div
            className="card"
            style={{
              padding: 'var(--space-4) var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-1)',
              borderColor: highlight ? 'rgba(192,184,168,0.15)' : undefined,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--teal)', fontWeight: 600, fontSize: '0.95rem' }}>{city.name}</span>
              {city.tier === 1 && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--gold)" stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              )}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--grey-600)' }}>
                Pop. {city.population >= 1000000
                  ? `${(city.population / 1000000).toFixed(1)}M`
                  : city.population >= 1000
                    ? `${Math.round(city.population / 1000)}K`
                    : city.population}
              </span>
              {city.region && (
                <span style={{ fontSize: '0.68rem', color: 'var(--grey-600)', borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: 'var(--space-3)' }}>
                  {city.region}
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
