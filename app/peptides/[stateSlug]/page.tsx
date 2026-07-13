import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CITIES, getStatesSlugs, getCitiesByState, getStateName, CITY_CONTENT_UPDATED } from '@/lib/cities/cities-data';

// ISR: regenerate hourly so per-state city counts/lists reflect data changes
// between full deploys (individual city pages already use ISR).
export const revalidate = 3600;

// ─── Static params ───────────────────────────────────────────────────────────
export async function generateStaticParams() {
  return getStatesSlugs().map((stateSlug) => ({ stateSlug }));
}

// ─── Per-state metadata ──────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ stateSlug: string }>;
}): Promise<Metadata> {
  const { stateSlug } = await params;
  const cities = getCitiesByState(stateSlug);
  if (cities.length === 0) return { robots: { index: false } };

  const stateName = getStateName(stateSlug);
  const title = `Research Peptides In ${stateName} | ${cities.length} Cities | Pep Nation Lab`;
  const description = `Pep Nation Lab supplies research-grade peptides to qualified researchers across ${cities.length} cities in ${stateName}. BPC-157, Semaglutide, Tirzepatide, TB-500 and 100+ more research compounds. Wholesale pricing. Verified accounts only.`;

  return {
    title,
    description,
    alternates: { canonical: `https://pepnationlab.com/peptides/${stateSlug}` },
    // No `images` - the file-based opengraph-image.tsx in this segment
    // generates a unique per-state OG card; a static image would override it.
    openGraph: {
      title,
      description,
      url: `https://pepnationlab.com/peptides/${stateSlug}`,
      siteName: 'Pep Nation Lab',
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
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
}

// ─── Page component ──────────────────────────────────────────────────────────
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

  // Generic but localized FAQs for the state page
  const stateFaqs = [
    {
      question: `Are research peptides legal in ${stateName}?`,
      answer: `Yes, research peptides are legally available in ${stateName} when purchased strictly for in vitro laboratory research and analytical purposes. They are not intended for human consumption or therapeutic use.`,
    },
    {
      question: `How fast do you ship to ${stateName}?`,
      answer: `Most orders destined for ${stateName} are processed and shipped within 24 hours. Depending on your exact location and the selected shipping tier, delivery typically takes 2-4 business days.`,
    },
    {
      question: `Do you provide COAs for orders in ${stateName}?`,
      answer: `Yes, every batch of our research compounds undergoes rigorous third-party analytical testing. Certificates of Analysis (COAs) confirming purity and mass are available for all researchers in ${stateName}.`,
    },
  ];

  // Sort: Tier 1 first, then by population desc within each tier
  const sorted = [...cities].sort((a, b) => a.tier - b.tier || b.population - a.population);

  const tier1 = sorted.filter((c) => c.tier === 1);
  const tier2 = sorted.filter((c) => c.tier === 2);
  const tier3 = sorted.filter((c) => c.tier === 3);

  // Region silo: group cities by their regional label (Chicagoland area,
  // Central Illinois, Metro East, ...) so the hub interlinks geography the
  // way searchers and search engines understand it. Regions ordered by size.
  const regionMap = new Map<string, typeof sorted>();
  for (const c of sorted) {
    const label = c.region ?? `Greater ${stateName}`;
    if (!regionMap.has(label)) regionMap.set(label, []);
    regionMap.get(label)!.push(c);
  }
  const regions = Array.from(regionMap.entries()).sort((a, b) => b[1].length - a[1].length);

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
        publisher: { '@id': 'https://pepnationlab.com/#organization' },
        datePublished: '2026-07-01',
        dateModified: CITY_CONTENT_UPDATED.toISOString().slice(0, 10),
      },
      // ItemList of every covered city - lets search engines and AI models
      // enumerate coverage ("what cities does Pep Nation Lab serve in X?").
      {
        '@type': 'ItemList',
        name: `Cities Covered In ${stateName}`,
        numberOfItems: sorted.length,
        itemListElement: sorted.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `${c.name}, ${c.stateAbbr}`,
          url: `https://pepnationlab.com/peptides/${stateSlug}/${c.slug}`,
        })),
      },
      // FAQPage schema
      {
        '@type': 'FAQPage',
        mainEntity: stateFaqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
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

        {/* ── HERO ─────────────────────────────────────────────────────── */}
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
              <span className="badge badge-silver" style={{ fontSize: '0.68rem' }}>{stateAbbr} - {cities.length} Cities</span>
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

            <p style={{ fontSize: '1.05rem', maxWidth: 620, color: 'var(--silver-light)', lineHeight: 1.75, marginBottom: 'var(--space-4)' }}>
              Pep Nation Lab serves qualified researchers across{' '}
              <strong style={{ color: 'var(--white)' }}>{cities.length} cities in {stateName}</strong>. Select your city
              for local peptide research coverage, wholesale pricing, and nearby agent support.
            </p>

            {/* Unique per-state summary - generated from real market data so
                every state page carries copy no other page has. */}
            <p style={{ fontSize: '0.92rem', maxWidth: 620, color: 'var(--grey-400)', lineHeight: 1.7, marginBottom: 'var(--space-7)' }}>
              {sorted.length > 2
                ? `Coverage In ${stateName} Spans ${sorted[0].name}, ${sorted[1].name}, ${sorted[2].name}, And ${sorted.length - 3 > 0 ? `${sorted.length - 3} More ${sorted.length - 3 === 1 ? 'City' : 'Cities'}` : 'More'}.`
                : `Coverage In ${stateName} Includes ${sorted.map((c) => c.name).join(' And ')}.`}{' '}
              {tier1.length > 0
                ? `${tier1.map((c) => c.name).slice(0, 3).join(', ')} ${tier1.length === 1 ? 'Is A Priority Market' : 'Are Priority Markets'} With The Fastest Fulfillment Tier.`
                : `All ${stateName} Orders Ship With Standard Nationwide Fulfillment.`}{' '}
              Verified researchers in every listed city order from the same 100+ compound wholesale catalog with batch COA documentation.
            </p>

            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              {/* Primary CTA points at an indexable page - /login is robots-disallowed,
                  so it stays as the secondary link only. */}
              <Link href="/research" className="btn btn-primary btn-xl">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 3h12"/><path d="M9 3v6l-5 9a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-5-9V3"/>
                </svg>
                Browse Research Library
              </Link>
              <Link href="/login" className="btn btn-secondary btn-xl">
                Access The Lab
              </Link>
            </div>
          </div>
        </section>

        {/* ── CITY GRID ───────────────────────────────────────────────────── */}
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
                  <span style={{ fontSize: '0.7rem', color: 'var(--grey-600)', fontWeight: 400 }}>Highest tier - fastest fulfillment</span>
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

        {/* ── BROWSE BY REGION - geographic silo interlinking ──────────── */}
        {regions.length > 1 && (
          <section style={{ padding: 'clamp(48px, 6vw, 80px) 0', borderTop: 'var(--border-subtle)', background: 'var(--black-2)' }}>
            <div className="container">
              <h2 style={{ color: 'var(--white)', fontSize: 'clamp(1.4rem, 2.5vw, 1.9rem)', fontWeight: 800, marginBottom: 'var(--space-3)' }}>
                Browse {stateName} By <span style={{ color: 'var(--teal)' }}>Region</span>
              </h2>
              <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem', maxWidth: 640, lineHeight: 1.7, marginBottom: 'var(--space-8)' }}>
                Research peptide coverage across every major region of {stateName} - from the {regions[0][0]} to {regions[regions.length - 1][0]}.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
                {regions.map(([label, regionCities]) => (
                  <div key={label}>
                    <h3 style={{ color: 'var(--silver-light)', fontSize: '0.95rem', fontWeight: 700, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      {label}
                      <span style={{ fontSize: '0.7rem', color: 'var(--grey-600)', fontWeight: 400 }}>
                        {regionCities.length} {regionCities.length === 1 ? 'City' : 'Cities'}
                      </span>
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      {regionCities.map((c) => (
                        <Link key={c.slug} href={`/peptides/${stateSlug}/${c.slug}`} style={{ padding: '5px 14px', fontSize: '0.78rem', color: 'var(--grey-400)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 'var(--radius-full)', textDecoration: 'none' }}>
                          {c.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── STATE FAQ ─────────────────────────────────────────────── */}
        <section style={{ padding: 'clamp(60px, 8vw, 100px) 0', background: 'linear-gradient(to bottom, var(--black), var(--black-2))' }}>
          <div className="container" style={{ maxWidth: 780 }}>
            <h2 style={{ color: 'var(--white)', fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 800, marginBottom: 'var(--space-6)', textAlign: 'center' }}>
              Frequently Asked Questions In <span style={{ color: 'var(--teal)' }}>{stateName}</span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {stateFaqs.map((faq, i) => (
                <details key={i} className="glass-panel" style={{ overflow: 'hidden' }}>
                  <summary style={{ padding: 'var(--space-5) var(--space-6)', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', color: 'var(--silver-light)', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <span>{faq.question}</span>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </summary>
                  <div style={{ padding: '0 var(--space-6) var(--space-5)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <p style={{ fontSize: '0.87rem', color: 'var(--grey-400)', lineHeight: 1.78, margin: 0, paddingTop: 'var(--space-4)' }}>
                      {faq.answer}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── BACK LINK ───────────────────────────────────────────────────── */}
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

// ─── City card grid component ────────────────────────────────────────────────
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
