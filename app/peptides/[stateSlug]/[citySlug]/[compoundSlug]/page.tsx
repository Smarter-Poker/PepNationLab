/**
 * app/peptides/[stateSlug]/[citySlug]/[compoundSlug]/page.tsx
 *
 * Compound-city landing page - captures buying-intent queries like
 * "BPC-157 Oak Lawn" or "Semaglutide Naperville".
 * URL pattern: pepnationlab.com/peptides/illinois/oak-lawn/bpc-157
 *
 * Rendered ON DEMAND (ISR): NO generateStaticParams, dynamicParams = true, so
 * build time is unaffected as the city x compound matrix grows. 404 via
 * notFound() when either the city or the compound is unknown.
 *
 * Server component (no 'use client'): the full page is server-rendered plain
 * JSX so every internal link and JSON-LD node ships in the initial HTML.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CITIES, getCity, CITY_CONTENT_UPDATED } from '@/lib/cities/cities-data';
import type { City } from '@/lib/cities/cities-data';
import { CITY_COMPOUNDS, getCityCompound } from '@/lib/cities/city-compounds';
import type { CityCompound } from '@/lib/cities/city-compounds';
import { getCompound } from '@/lib/compounds-server';
import { evidenceTier } from '@/lib/compounds';
import { getCompoundStoreCards } from '@/lib/cities/compound-store';
import type { CompoundStoreCard } from '@/lib/cities/compound-store';
import { getRegionLabel, getRegionArea } from '@/lib/cities/city-content';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';

// ISR: regenerate at most every 5 minutes so the live price card tracks the
// storefront catalog without a redeploy.
export const revalidate = 300;

// Render any city x curated-compound pair on first request (cached at the edge
// afterward). No generateStaticParams on purpose - keeps build time bounded.
export const dynamicParams = true;

const BASE = 'https://pepnationlab.com';

// FAQ builder (compound + city blend)
interface FAQ {
  question: string;
  answer: string;
}

function buildFAQs(city: City, compound: CityCompound): FAQ[] {
  const region = getRegionLabel(city);
  const name = compound.displayName;
  return [
    {
      question: `Does Pep Nation Lab Ship ${name} To ${city.name}, ${city.stateAbbr}?`,
      answer: `Yes. Pep Nation Lab ships research-grade ${name} to all 50 states, including ${city.state}. Orders placed by verified researchers in ${city.name} and the surrounding ${getRegionArea(region)} are typically processed same-day and shipped with discrete, lab-appropriate packaging and full batch documentation.`,
    },
    {
      question: `Is ${name} Available At Wholesale Pricing In ${city.name}?`,
      answer: `Verified research accounts serving ${city.name}, ${city.stateAbbr} access ${name} at wholesale, tier-based pricing with no retail markup. The live price shown above mirrors the current Pep Nation Lab research store and updates automatically when catalog pricing changes.`,
    },
    {
      question: `What Is ${name} Studied For In Laboratory Research?`,
      answer: `${compound.positioning} Researchers in ${city.name} can review the full ${name} monograph, including mechanism, evidence tier, and references, in the Pep Nation Lab research library.`,
    },
    {
      question: `Can Researchers In ${city.name} Use ${name} On Humans Or Animals?`,
      answer: `No. ${name} sold by Pep Nation Lab is strictly for in vitro laboratory research and analytical use only. It is not a pharmaceutical drug, is not FDA-approved, and is not for human or animal consumption, ingestion, or injection. Researchers in ${city.state} assume full responsibility for compliance with all applicable regulations.`,
    },
    {
      question: `How Is The Purity Of ${name} Verified?`,
      answer: `Every ${name} batch is sourced from certified synthesis facilities and ships with certificate-of-analysis (COA) documentation. Researchers in ${city.name}, ${city.stateAbbr} can review batch identity and purity data before use to confirm suitability for their laboratory protocols.`,
    },
    {
      question: `How Quickly Does ${name} Arrive In ${city.name}, ${city.stateAbbr}?`,
      answer: `Verified researcher orders for ${name} are typically processed same-day when placed before the fulfillment cutoff, then shipped nationwide. Transit to ${city.name} follows standard carrier timelines for ${city.state}, and tracking is provided on every shipment.`,
    },
  ];
}

// Metadata
export async function generateMetadata({
  params,
}: {
  params: Promise<{ stateSlug: string; citySlug: string; compoundSlug: string }>;
}): Promise<Metadata> {
  const { stateSlug, citySlug, compoundSlug } = await params;
  const city = getCity(stateSlug, citySlug);
  const compound = getCityCompound(compoundSlug);
  if (!city || !compound) return { robots: { index: false } };

  // Selective indexing: index high-value tier-1/2 markets; noindex (but still
  // follow) the tier-3 long tail so the thin compound-city pages do not dilute
  // crawl budget or trip doorway-content heuristics.
  const indexable = city.tier <= 2;

  const title = `${compound.displayName} In ${city.name}, ${city.stateAbbr} - Research-Grade Supply`;
  const description = `Buy research-grade ${compound.displayName} (${compound.popularName}) for verified researchers in ${city.name}, ${city.state}. Live wholesale pricing, batch COA documentation, fast nationwide shipping. In vitro laboratory use only.`;
  const url = `${BASE}/peptides/${stateSlug}/${citySlug}/${compoundSlug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
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
      index: indexable,
      follow: true,
      googleBot: {
        index: indexable,
        follow: true,
        'max-snippet': -1,
        'max-image-preview': 'large',
        'max-video-preview': -1,
      },
    },
  };
}

// Page
export default async function CompoundCityPage({
  params,
}: {
  params: Promise<{ stateSlug: string; citySlug: string; compoundSlug: string }>;
}) {
  const { stateSlug, citySlug, compoundSlug } = await params;
  const city = getCity(stateSlug, citySlug);
  const compound = getCityCompound(compoundSlug);
  if (!city || !compound) notFound();

  const region = getRegionLabel(city);
  const [monograph, storeCards] = await Promise.all([
    getCompound(compound.slug),
    getCompoundStoreCards(),
  ]);
  const card: CompoundStoreCard | null = storeCards[compound.slug] ?? null;

  const faqs = buildFAQs(city, compound);
  const tier = monograph ? evidenceTier(monograph.evidence_tier) : null;

  const pageUrl = `${BASE}/peptides/${stateSlug}/${citySlug}/${compoundSlug}`;
  const monographUrl = `${BASE}/research/${compound.slug}`;
  const storeHref = card
    ? `/${DEFAULT_STORE_SLUG}?product=${card.productId}`
    : `/${DEFAULT_STORE_SLUG}`;

  // Sibling compounds in the SAME city (3-4).
  const siblings = CITY_COMPOUNDS.filter((c) => c.slug !== compound.slug).slice(0, 4);

  // Nearby cities offering the SAME compound (6-8). Same-region first, then by
  // population, mirroring the city page's NearbyStrip silo logic.
  const nearbyCities = CITIES
    .filter((c) => c.slug !== city.slug)
    .sort((a, b) => {
      const aSame = city.region && a.region === city.region ? 1 : 0;
      const bSame = city.region && b.region === city.region ? 1 : 0;
      if (aSame !== bSame) return bSame - aSame;
      const aState = a.stateSlug === stateSlug ? 1 : 0;
      const bState = b.stateSlug === stateSlug ? 1 : 0;
      if (aState !== bState) return bState - aState;
      return b.population - a.population;
    })
    .slice(0, 8);

  // JSON-LD graph (server-rendered). A Product node is only emitted when a
  // real price exists: Google's Product spec requires offers/review/rating,
  // and a Product with none of them draws "missing field (offers)" warnings
  // in Search Console. With no price we fall back to a plain Thing via the
  // WebPage `about` node below, which carries no such requirement.
  const hasOffer = Boolean(card && Number.isFinite(card.price) && card.price > 0);
  const productNode: Record<string, unknown> | null = hasOffer
    ? {
        '@type': 'Product',
        name: `${compound.displayName} - Research Grade`,
        description: `Research-grade ${compound.displayName} (${compound.popularName}) for qualified researchers in ${city.name}, ${city.state}. In vitro laboratory use only.`,
        brand: { '@id': `${BASE}/#organization` },
        category: monograph?.category ?? 'Research Peptide',
        offers: {
          '@type': 'Offer',
          price: (card!.price as number).toFixed(2),
          priceCurrency: 'USD',
          priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          itemCondition: 'https://schema.org/NewCondition',
          availability: 'https://schema.org/InStock',
          url: `${BASE}${storeHref}`,
          seller: { '@id': `${BASE}/#organization` },
        },
      }
    : null;
  if (productNode && card?.image) {
    // Guard: DB image URLs may already be absolute (Supabase storage).
    productNode.image = String(card.image).startsWith('http')
      ? card.image
      : `${BASE}${card.image}`;
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
          { '@type': 'ListItem', position: 2, name: 'Peptides By City', item: `${BASE}/peptides` },
          { '@type': 'ListItem', position: 3, name: city.state, item: `${BASE}/peptides/${stateSlug}` },
          { '@type': 'ListItem', position: 4, name: city.name, item: `${BASE}/peptides/${stateSlug}/${citySlug}` },
          { '@type': 'ListItem', position: 5, name: compound.displayName, item: pageUrl },
        ],
      },
      ...(productNode ? [productNode] : []),
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
      {
        '@type': 'WebPage',
        '@id': pageUrl,
        url: pageUrl,
        name: `${compound.displayName} In ${city.name}, ${city.stateAbbr}`,
        isPartOf: { '@id': `${BASE}/#website` },
        publisher: { '@id': `${BASE}/#organization` },
        datePublished: '2026-07-10',
        dateModified: CITY_CONTENT_UPDATED.toISOString().slice(0, 10),
        about: { '@type': 'Thing', name: compound.displayName, sameAs: monographUrl },
      },
    ],
  };

  const glass = {
    background: 'linear-gradient(180deg, rgba(22,34,48,0.6) 0%, rgba(15,25,35,0.6) 100%)',
    border: '1px solid rgba(192,184,168,0.12)',
    borderRadius: 'var(--radius-xl, 18px)',
  } as const;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div style={{ background: 'var(--black, #050A0F)', minHeight: '100dvh', color: 'var(--white, #fff)' }}>
        {/* HERO */}
        <section style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid rgba(192,184,168,0.08)' }}>
          <Image
            src="/images/city-hero-peptide.jpg"
            alt={`Research-Grade ${compound.displayName} (${compound.popularName}) Available To Verified Researchers In ${city.name}, ${city.state}${city.county ? ` - ${city.county} County` : ''}`}
            fill
            priority
            fetchPriority="high"
            sizes="(max-width: 768px) 100vw, 1400px"
            quality={45}
            style={{ objectFit: 'cover', objectPosition: 'center right', opacity: 0.35 }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, var(--black, #050A0F) 40%, rgba(5,10,15,0.6) 75%, transparent 100%)', zIndex: 1 }} />

          <div className="container" style={{ position: 'relative', zIndex: 2, paddingTop: 'clamp(90px, 12vw, 150px)', paddingBottom: 'clamp(48px, 7vw, 90px)' }}>
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" style={{ marginBottom: 'var(--space-5, 20px)' }}>
              <ol style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', listStyle: 'none', padding: 0, margin: 0 }}>
                {[
                  { label: 'Home', href: '/' },
                  { label: 'Peptides By City', href: '/peptides' },
                  { label: city.state, href: `/peptides/${stateSlug}` },
                  { label: city.name, href: `/peptides/${stateSlug}/${citySlug}` },
                  { label: compound.displayName, href: null },
                ].map((crumb, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {i > 0 && <span style={{ color: 'var(--grey-600, #5a6572)', fontSize: '0.65rem' }}>&#8250;</span>}
                    {crumb.href ? (
                      <Link href={crumb.href} style={{ fontSize: '0.76rem', color: 'var(--grey-500, #8593a0)', textDecoration: 'none' }}>
                        {crumb.label}
                      </Link>
                    ) : (
                      <span style={{ fontSize: '0.76rem', color: 'var(--silver, #A8B4C0)' }}>{crumb.label}</span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>

            {/* Badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-5, 20px)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 999, border: '1px solid rgba(229,62,62,0.4)', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#ff6b6b' }}>
                Research Use Only
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 999, background: 'rgba(192,184,168,0.08)', border: '1px solid rgba(192,184,168,0.2)', fontSize: '0.66rem', fontWeight: 600, color: 'var(--silver, #A8B4C0)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {city.name}, {city.stateAbbr}
              </span>
              {tier && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 999, background: 'rgba(0,196,188,0.08)', border: '1px solid rgba(0,196,188,0.25)', fontSize: '0.66rem', fontWeight: 700, color: 'var(--teal, #00C4BC)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {tier.label}
                </span>
              )}
            </div>

            {/* H1 */}
            <h1 style={{ color: 'var(--white, #fff)', fontSize: 'clamp(2.1rem, 5vw, 3.8rem)', fontWeight: 900, lineHeight: 1.06, letterSpacing: '-0.03em', marginBottom: 'var(--space-4, 16px)', maxWidth: 820, fontFamily: 'var(--font-brand, inherit)' }}>
              <span style={{ color: 'var(--teal, #00C4BC)', textShadow: '0 0 40px rgba(0,196,188,0.4)' }}>{compound.displayName}</span>{' '}
              In {city.name}, {city.stateAbbr}
              <span style={{ display: 'block', fontSize: 'clamp(1rem, 2vw, 1.5rem)', color: 'var(--silver, #A8B4C0)', fontWeight: 600, marginTop: 8 }}>
                Research-Grade Supply
              </span>
            </h1>

            <p style={{ fontSize: 'clamp(0.98rem, 1.6vw, 1.12rem)', maxWidth: 620, color: 'var(--silver-light, #D0DAE4)', lineHeight: 1.7, marginBottom: 'var(--space-5, 20px)' }}>
              {compound.positioning}
            </p>

            {city.localBlurb && (
              <p style={{ fontSize: '0.92rem', maxWidth: 620, color: 'var(--teal, #00C4BC)', lineHeight: 1.6, fontStyle: 'italic', opacity: 0.9, margin: 0 }}>
                {city.localBlurb}
              </p>
            )}
          </div>
        </section>

        {/* OVERVIEW + LIVE PRICE */}
        <section style={{ padding: 'clamp(48px, 7vw, 88px) 0' }}>
          <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6, 24px)', alignItems: 'start' }}>
            {/* Monograph overview */}
            <div style={{ ...glass, padding: 'clamp(22px, 3vw, 34px)' }}>
              <h2 style={{ color: 'var(--white, #fff)', fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 'var(--space-4, 16px)' }}>
                {compound.displayName} Research Overview
              </h2>

              <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--space-3, 12px)', margin: '0 0 var(--space-5, 20px)' }}>
                {[
                  { label: 'Popular Name', value: compound.popularName },
                  { label: 'Category', value: monograph?.category ?? 'Research Peptide' },
                  { label: 'Evidence Tier', value: tier?.label ?? 'Research Compound' },
                  monograph?.compound_class ? { label: 'Class', value: monograph.compound_class } : null,
                  monograph?.molecular_target ? { label: 'Primary Target', value: monograph.molecular_target } : null,
                  monograph?.half_life ? { label: 'Half-Life', value: monograph.half_life } : null,
                  monograph?.pubmed_citation_count ? { label: 'PubMed Citations', value: monograph.pubmed_citation_count.toLocaleString() } : null,
                  monograph?.active_trial_count ? { label: 'Active Trials', value: String(monograph.active_trial_count) } : null,
                ]
                  .filter((x): x is { label: string; value: string } => Boolean(x))
                  .map((f) => (
                    <div key={f.label} style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.25)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                      <dt style={{ fontSize: '0.6rem', color: 'var(--grey-500, #8593a0)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{f.label}</dt>
                      <dd style={{ fontSize: '0.82rem', color: 'var(--silver-light, #D0DAE4)', margin: 0, lineHeight: 1.5 }}>{f.value}</dd>
                    </div>
                  ))}
              </dl>

              {monograph?.mechanism && (
                <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
                  <h3 style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Mechanism Of Action</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--grey-300, #b8c2ce)', lineHeight: 1.7, margin: 0 }}>{monograph.mechanism}</p>
                </div>
              )}

              {monograph?.studied_for && monograph.studied_for.length > 0 && (
                <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
                  <h3 style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Studied For</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {monograph.studied_for.slice(0, 8).map((s) => (
                      <span key={s} style={{ padding: '4px 11px', fontSize: '0.74rem', color: 'var(--silver, #A8B4C0)', background: 'rgba(192,184,168,0.06)', border: '1px solid rgba(192,184,168,0.15)', borderRadius: 999 }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}

              <Link href={`/research/${compound.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: 'var(--teal, #00C4BC)', textDecoration: 'none' }}>
                Read The Full {compound.displayName} Monograph &#8250;
              </Link>
            </div>

            {/* Live price card */}
            <div style={{ ...glass, padding: 'clamp(22px, 3vw, 34px)', position: 'relative', overflow: 'hidden' }}>
              <h2 style={{ color: 'var(--white, #fff)', fontSize: 'clamp(1.3rem, 2.6vw, 1.7rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 'var(--space-2, 8px)' }}>
                Live {compound.displayName} Pricing
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--grey-400, #9aa6b2)', lineHeight: 1.6, marginBottom: 'var(--space-5, 20px)' }}>
                Wholesale pricing for verified researchers in {city.name}, {city.stateAbbr}, mirrored live from the Pep Nation Lab research store.
              </p>

              {card ? (
                <Link href={storeHref} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{ background: 'linear-gradient(180deg, #1a1f2e 0%, #111520 100%)', borderRadius: 15, border: '1px solid rgba(192,184,168,0.15)', overflow: 'hidden' }}>
                    <div style={{ position: 'relative', height: 200, background: 'var(--surface-2, #162230)' }}>
                      <Image
                        src={card.image}
                        alt={`${compound.displayName} (${compound.popularName}) Research Peptide ${card.sizeLabel} - Available To Researchers In ${city.name}, ${city.stateAbbr}`}
                        fill
                        sizes="(max-width: 768px) 100vw, 420px"
                        style={{ objectFit: 'cover' }}
                        unoptimized={card.image.startsWith('http')}
                      />
                    </div>
                    <div style={{ padding: 'var(--space-5, 20px)', textAlign: 'center' }}>
                      <h3 style={{ fontFamily: 'var(--font-brand, inherit)', fontSize: '1.25rem', color: 'var(--white, #fff)', marginBottom: card.subtitle ? 2 : 8, lineHeight: 1.2 }}>{card.name}</h3>
                      {card.subtitle && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--grey-400, #9aa6b2)', display: 'block', marginBottom: 8 }}>({card.subtitle})</span>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 'var(--space-4, 16px)' }}>
                        {card.originalPrice !== null && (
                          <span style={{ fontSize: '0.95rem', color: 'var(--grey-500, #8593a0)', textDecoration: 'line-through', fontWeight: 600 }}>${card.originalPrice.toFixed(2)}</span>
                        )}
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-brand, inherit)', color: 'var(--white, #fff)' }}>
                          {card.sizeLabel} &nbsp;${card.price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 'var(--space-4, 16px)', textAlign: 'center', padding: '12px 18px', borderRadius: 999, background: 'var(--teal, #00C4BC)', color: '#04211f', fontWeight: 800, fontSize: '0.9rem' }}>
                    View {compound.displayName} In The Research Store
                  </div>
                </Link>
              ) : (
                <Link href={storeHref} style={{ display: 'block', textAlign: 'center', padding: '14px 18px', borderRadius: 999, background: 'var(--teal, #00C4BC)', color: '#04211f', fontWeight: 800, fontSize: '0.9rem', textDecoration: 'none' }}>
                  Browse {compound.displayName} In The Research Store
                </Link>
              )}

              <div data-nosnippet style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 'var(--space-5, 20px)', background: 'rgba(229,62,62,0.06)', border: '1px solid rgba(229,62,62,0.18)', borderRadius: 12, padding: '11px 15px' }}>
                <p style={{ fontSize: '0.72rem', color: 'var(--silver, #A8B4C0)', margin: 0, lineHeight: 1.6 }}>
                  Strictly For <strong style={{ color: 'var(--red, #E53E3E)' }}>In Vitro Research Use Only.</strong> Not For Human Or Animal Consumption. Verified Researchers Only.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CITY CONTEXT */}
        <section style={{ padding: 'clamp(40px, 6vw, 72px) 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="container">
            <h2 style={{ color: 'var(--white, #fff)', fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 'var(--space-4, 16px)', maxWidth: 720 }}>
              Sourcing {compound.displayName} In The {getRegionArea(region)}
            </h2>
            <p style={{ fontSize: '0.95rem', color: 'var(--silver-light, #D0DAE4)', lineHeight: 1.75, maxWidth: 780, marginBottom: 'var(--space-5, 20px)' }}>
              Pep Nation Lab supplies research-grade {compound.displayName} to verified researchers across {city.name}, {city.stateAbbr}
              {city.county ? `, in ${city.county} County` : ''} and the wider {getRegionArea(region)}. Every {compound.displayName} order ships nationwide with full batch COA documentation, strictly for in vitro laboratory use.
            </p>
            <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3, 12px)', margin: 0 }}>
              {[
                { label: 'Service Area', value: `${city.name}, ${city.stateAbbr} (${region})` },
                city.county ? { label: 'County', value: `${city.county} County, ${city.state}` } : null,
                city.zips && city.zips.length > 0 ? { label: 'ZIP Codes Served', value: city.zips.join(', ') } : null,
                { label: 'Shipping', value: `Nationwide To All 50 States, Including ${city.state}` },
                { label: 'Compound', value: `${compound.displayName} (${compound.popularName})` },
                { label: 'Documentation', value: 'Batch COA Included With Every Order' },
                { label: 'Intended Use', value: 'In Vitro Laboratory Research Only' },
              ]
                .filter((x): x is { label: string; value: string } => Boolean(x))
                .map((f) => (
                  <div key={f.label} style={{ ...glass, padding: '14px 18px' }}>
                    <dt style={{ fontSize: '0.62rem', color: 'var(--grey-500, #8593a0)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{f.label}</dt>
                    <dd style={{ fontSize: '0.85rem', color: 'var(--silver-light, #D0DAE4)', margin: 0, lineHeight: 1.55 }}>{f.value}</dd>
                  </div>
                ))}
            </dl>
          </div>
        </section>

        {/* FAQ */}
        <section style={{ padding: 'clamp(48px, 7vw, 88px) 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="container" style={{ maxWidth: 820, margin: '0 auto' }}>
            <h2 style={{ color: 'var(--white, #fff)', fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 'var(--space-6, 24px)', textAlign: 'center' }}>
              {compound.displayName} In {city.name} - Common Questions
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
              {faqs.map((faq, i) => (
                <details key={i} style={{ ...glass, overflow: 'hidden' }}>
                  <summary style={{ padding: '18px 22px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', color: 'var(--silver-light, #D0DAE4)', listStyle: 'none' }}>
                    {faq.question}
                  </summary>
                  <div style={{ padding: '0 22px 18px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <p style={{ fontSize: '0.87rem', color: 'var(--grey-400, #9aa6b2)', lineHeight: 1.78, margin: 0, paddingTop: 14 }}>{faq.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* SIBLING COMPOUNDS + NEARBY CITIES */}
        <section style={{ padding: 'clamp(40px, 6vw, 72px) 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="container">
            {/* Sibling compounds in this city */}
            <p style={{ fontSize: '0.7rem', color: 'var(--grey-600, #5a6572)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-3, 12px)' }}>
              More Research Compounds In {city.name}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-8, 32px)' }}>
              {siblings.map((s) => (
                <Link key={s.slug} href={`/peptides/${stateSlug}/${citySlug}/${s.slug}`} style={{ padding: '6px 15px', fontSize: '0.8rem', color: 'var(--silver, #A8B4C0)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, textDecoration: 'none' }}>
                  {s.displayName} In {city.name}
                </Link>
              ))}
              <Link href={`/peptides/${stateSlug}/${citySlug}`} style={{ padding: '6px 15px', fontSize: '0.8rem', color: 'var(--teal, #00C4BC)', background: 'rgba(0,196,188,0.08)', border: '1px solid rgba(0,196,188,0.25)', borderRadius: 999, textDecoration: 'none', fontWeight: 600 }}>
                All Peptides In {city.name} &#8250;
              </Link>
            </div>

            {/* Same compound in nearby cities */}
            <p style={{ fontSize: '0.7rem', color: 'var(--grey-600, #5a6572)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-3, 12px)' }}>
              {compound.displayName} In Nearby Cities
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2, 8px)' }}>
              {nearbyCities.map((c) => (
                <Link key={`${c.stateSlug}-${c.slug}`} href={`/peptides/${c.stateSlug}/${c.slug}/${compound.slug}`} style={{ padding: '6px 15px', fontSize: '0.8rem', color: 'var(--silver, #A8B4C0)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, textDecoration: 'none' }}>
                  {compound.displayName} In {c.stateSlug === stateSlug ? c.name : `${c.name}, ${c.stateAbbr}`}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* FOOTER DISCLAIMER */}
        <footer style={{ background: 'var(--black, #050A0F)', borderTop: '1px solid rgba(192,184,168,0.06)', padding: 'var(--space-8, 32px) 0' }}>
          <div className="container">
            <div data-nosnippet style={{ background: 'rgba(229,62,62,0.04)', border: '1px solid rgba(229,62,62,0.12)', borderRadius: 10, padding: 'var(--space-4, 16px)', marginBottom: 'var(--space-6, 24px)' }}>
              <p style={{ fontSize: '0.71rem', color: 'var(--grey-500, #8593a0)', lineHeight: 1.7, textAlign: 'center', margin: 0 }}>
                <strong style={{ color: 'rgba(229,62,62,0.8)' }}>Research Use Only Disclaimer:</strong>{' '}
                All products sold on PepNationLab.com, including {compound.displayName}, are strictly for in vitro laboratory research and analytical purposes only.
                They are NOT intended for human or animal consumption, ingestion, or injection.
                These products have not been evaluated or approved by the FDA.
                Purchasers assume full legal responsibility for compliance with all applicable laws.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4, 16px)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-5, 20px)', flexWrap: 'wrap' }}>
                {[
                  { label: 'Home', href: '/' },
                  { label: 'Research Library', href: '/research' },
                  { label: `${compound.displayName} Monograph`, href: `/research/${compound.slug}` },
                  { label: `Peptides In ${city.name}`, href: `/peptides/${stateSlug}/${citySlug}` },
                  { label: 'Disclaimer', href: '/disclaimer' },
                ].map(({ label, href }) => (
                  <Link key={label} href={href} style={{ fontSize: '0.76rem', color: 'var(--grey-600, #5a6572)', textDecoration: 'none' }}>{label}</Link>
                ))}
              </div>
              <p style={{ fontSize: '0.73rem', color: 'var(--grey-600, #5a6572)', margin: 0 }}>
                &copy; {new Date().getFullYear()} Pep Nation Lab LLC. All Rights Reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
