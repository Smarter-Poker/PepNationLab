import type { Metadata } from 'next';
import Link from 'next/link';
import { CITIES, getCitiesGroupedByState, getStatesSlugs, getStateName, CITY_CONTENT_UPDATED } from '@/lib/cities/cities-data';

export const metadata: Metadata = {
  title: 'Research Peptides By City | Nationwide Coverage | Pep Nation Lab',
  description: `Pep Nation Lab ships research-grade peptides to qualified researchers in ${CITIES.length} US cities. Browse by state and city to find local research peptide coverage. 100+ research compounds at wholesale pricing.`,
  alternates: { canonical: 'https://pepnationlab.com/peptides' },
  openGraph: {
    title: 'Research Peptides By City | Pep Nation Lab',
    description: `Browse research-grade peptide coverage by state and city. ${CITIES.length} cities, 100+ research compounds, wholesale pricing, verified accounts.`,
    url: 'https://pepnationlab.com/peptides',
    siteName: 'Pep Nation Lab',
    type: 'website',
    locale: 'en_US',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Pep Nation Lab — Peptides By City' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Research Peptides By City | Pep Nation Lab',
    description: `Browse research-grade peptide coverage by state and city. ${CITIES.length} cities, 100+ research compounds.`,
    images: ['/og-card.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
        { '@type': 'ListItem', position: 2, name: 'Peptides By City', item: 'https://pepnationlab.com/peptides' },
      ],
    },
    {
      '@type': 'CollectionPage',
      name: 'Research Peptides By City',
      url: 'https://pepnationlab.com/peptides',
      description: `Pep Nation Lab local coverage directory — research-grade peptides available nationwide across ${CITIES.length} US cities.`,
      publisher: { '@id': 'https://pepnationlab.com/#organization' },
      datePublished: '2026-07-01',
      dateModified: CITY_CONTENT_UPDATED.toISOString().slice(0, 10),
    },
    // ItemList of state directory pages — lets search engines and AI models
    // enumerate coverage by state.
    {
      '@type': 'ItemList',
      name: 'Research Peptide Coverage By State',
      numberOfItems: getStatesSlugs().length,
      itemListElement: getStatesSlugs().map((slug, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: getStateName(slug),
        url: `https://pepnationlab.com/peptides/${slug}`,
      })),
    },
  ],
};

export default function PeptidesByStatePage() {
  const grouped = getCitiesGroupedByState();
  const stateEntries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  const totalCities = CITIES.length;

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
              <ol style={{ display: 'flex', gap: '6px', alignItems: 'center', listStyle: 'none', padding: 0, margin: 0 }}>
                <li>
                  <Link href="/" style={{ fontSize: '0.8rem', color: 'var(--grey-400)' }}>Home</Link>
                </li>
                <li style={{ color: 'var(--grey-600)', fontSize: '0.7rem' }}>›</li>
                <li>
                  <span style={{ fontSize: '0.8rem', color: 'var(--teal)' }}>Peptides By City</span>
                </li>
              </ol>
            </nav>

            <div className="badge badge-teal" style={{ marginBottom: 'var(--space-5)', fontSize: '0.68rem' }}>
              Nationwide Coverage
            </div>

            <h1 className="glow-teal" style={{ color: 'var(--white)', maxWidth: 700, marginBottom: 'var(--space-5)' }}>
              Research Peptides{' '}
              <span style={{ color: 'var(--teal)' }}>By City</span>
            </h1>

            <p style={{ fontSize: '1.05rem', maxWidth: 620, color: 'var(--silver-light)', lineHeight: 1.75, marginBottom: 'var(--space-8)' }}>
              Pep Nation Lab supplies research-grade peptides to qualified researchers across{' '}
              <strong style={{ color: 'var(--white)' }}>{totalCities} US cities</strong>. Browse by state to find local
              coverage, pricing tiers, and nearby agents.
            </p>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap', paddingTop: 'var(--space-6)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { num: `${totalCities}`, label: 'Cities Covered' },
                { num: `${stateEntries.length}`, label: 'States' },
                { num: '100+', label: 'Research Compounds' },
                { num: '3 Tiers', label: 'Wholesale Pricing' },
              ].map(({ num, label }) => (
                <div key={label}>
                  <div style={{ fontFamily: 'var(--font-brand)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--teal)' }}>{num}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── RUO STRIP ────────────────────────────────────────────── */}
        <div data-nosnippet style={{ background: 'rgba(229,62,62,0.05)', borderBottom: '1px solid rgba(229,62,62,0.15)', padding: 'var(--space-3) 0' }}>
          <div className="container">
            <p style={{ fontSize: '0.75rem', color: 'var(--grey-400)', margin: 0, textAlign: 'center' }}>
              <strong style={{ color: 'var(--red)' }}>Research Use Only:</strong>{' '}
              All products are strictly for in vitro laboratory use. Not for human or animal consumption. Verified researchers only.
            </p>
          </div>
        </div>

        {/* ── STATE GRID ───────────────────────────────────────────── */}
        <section className="section" style={{ paddingTop: 'var(--space-20)', paddingBottom: 'var(--space-20)' }}>
          <div className="container">
            <div style={{ marginBottom: 'var(--space-12)', textAlign: 'center' }}>
              <div className="badge badge-silver" style={{ marginBottom: 'var(--space-4)', fontSize: '0.7rem' }}>
                Browse by State
              </div>
              <h2 style={{ color: 'var(--white)', marginBottom: 'var(--space-4)' }}>
                Select Your State
              </h2>
              <p style={{ color: 'var(--grey-400)', fontSize: '0.95rem', maxWidth: 520, margin: '0 auto' }}>
                Each state page lists every covered city with direct links to local research peptide pages.
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 'var(--space-4)',
            }}>
              {stateEntries.map(([stateSlug, cities]) => {
                const stateName = cities[0].state;
                const tier1Count = cities.filter((c) => c.tier === 1).length;
                const topCities = [...cities]
                  .sort((a, b) => a.tier - b.tier || b.population - a.population)
                  .slice(0, 3);

                return (
                  <Link
                    key={stateSlug}
                    href={`/peptides/${stateSlug}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div
                      className="card"
                      style={{
                        padding: 'var(--space-5)',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-3)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h3 style={{ color: 'var(--teal)', fontSize: '1.05rem', margin: 0 }}>{stateName}</h3>
                        <span style={{
                          fontSize: '0.65rem',
                          background: 'var(--teal-subtle)',
                          border: 'var(--border-teal)',
                          borderRadius: 'var(--radius-full)',
                          padding: '2px 8px',
                          color: 'var(--teal)',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}>
                          {cities.length} {cities.length === 1 ? 'city' : 'cities'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {topCities.map((c) => (
                          <span key={c.slug} style={{
                            fontSize: '0.72rem',
                            color: 'var(--grey-400)',
                            background: 'rgba(255,255,255,0.04)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '2px 7px',
                          }}>
                            {c.name}
                          </span>
                        ))}
                        {cities.length > 3 && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--grey-600)', padding: '2px 4px' }}>
                            +{cities.length - 3} more
                          </span>
                        )}
                      </div>

                      {tier1Count > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: 'auto' }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="var(--gold)" stroke="none">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                          <span style={{ fontSize: '0.68rem', color: 'var(--gold)' }}>
                            {tier1Count} Priority {tier1Count === 1 ? 'Market' : 'Markets'}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── BOTTOM CTA ───────────────────────────────────────────── */}
        <section style={{ background: 'var(--black-2)', borderTop: 'var(--border-subtle)', padding: 'var(--space-16) 0', textAlign: 'center' }}>
          <div className="container" style={{ maxWidth: 580 }}>
            <h2 style={{ color: 'var(--white)', marginBottom: 'var(--space-4)' }}>
              Not Seeing Your City?
            </h2>
            <p style={{ color: 'var(--grey-400)', lineHeight: 1.7, marginBottom: 'var(--space-6)', fontSize: '0.95rem' }}>
              Pep Nation Lab ships to all 50 states. If your city is not listed, you can still create a verified researcher account and access the full catalog with nationwide shipping.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/research" className="btn btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 3h12"/><path d="M9 3v6l-5 9a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-5-9V3"/>
                </svg>
                Browse Research Library
              </Link>
              <Link href="/login" className="btn btn-secondary">
                Access The Lab
              </Link>
            </div>
          </div>
        </section>

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
