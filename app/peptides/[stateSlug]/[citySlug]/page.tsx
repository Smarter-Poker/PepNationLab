/**
 * app/peptides/[stateSlug]/[citySlug]/page.tsx
 *
 * Local SEO city landing page.
 * URL pattern: pepnationlab.com/peptides/illinois/oak-lawn
 *
 * • generateStaticParams() → pre-renders top-priority cities; the rest via ISR
 * • generateMetadata()     → unique title/description/OG per city
 * • Inline JSON-LD schema  → BreadcrumbList + FAQPage (Server side rendered)
 * • CityPage is a 'use client' component for hover interactions
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CITIES, getCity, CITY_CONTENT_UPDATED } from '@/lib/cities/cities-data';
import { getStoreTop10 } from '@/lib/cities/top10-server';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';
import CityPage from './CityPage';

// ISR: regenerate each city page at most every 5 minutes so the Top 10 grid
// tracks the live storefront catalog - admin price/name changes flow through
// without a redeploy.
export const revalidate = 300;

// ─── Static params (build-time pre-rendering) ─────────────────────
// Scale-ready ISR: at build we pre-render ONLY the highest-priority markets
// (sorted by tier, then population) up to this small cap. Every other city -
// and any city added later - is rendered on first request via ISR and cached
// at the edge (dynamicParams defaults to true). This keeps build time flat as
// the city catalog grows into the thousands.
//
// WARNING: Do NOT raise this cap to pre-render the whole catalog. Pre-rendering
// ~1000 city pages (each doing a storefront Top-10 DB fetch) at build time is
// what caused exponential Vercel build times. The long tail belongs on ISR.
const STATIC_CITY_LIMIT = 24;

export async function generateStaticParams() {
  return [...CITIES]
    .sort((a, b) => a.tier - b.tier || b.population - a.population)
    .slice(0, STATIC_CITY_LIMIT)
    .map((city) => ({
      stateSlug: city.stateSlug,
      citySlug: city.slug,
    }));
}

// ─── Per-city metadata ──────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ stateSlug: string; citySlug: string }>;
}): Promise<Metadata> {
  const { stateSlug, citySlug } = await params;
  const city = getCity(stateSlug, citySlug);
  if (!city) return { robots: { index: false } };

  const title = `Peptide Research In ${city.name}, ${city.stateAbbr} - Pep Nation Lab`;
  const description = `Pep Nation Lab supplies research-grade peptides to qualified researchers in ${city.name}, ${city.state}. BPC-157, Semaglutide, Tirzepatide, TB-500 & 100+ more research compounds. Wholesale pricing. Verified accounts only.`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://pepnationlab.com/peptides/${stateSlug}/${citySlug}`,
    },
    // NOTE: no `images` here on purpose - the file-based opengraph-image.tsx
    // in this route segment generates a unique per-city OG card. Declaring a
    // static image in metadata would override and kill the dynamic one.
    openGraph: {
      title,
      description,
      url: `https://pepnationlab.com/peptides/${stateSlug}/${citySlug}`,
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

// ─── Page shell (server component) ───────────────────────────────────────
export default async function CityLandingPage({
  params,
}: {
  params: Promise<{ stateSlug: string; citySlug: string }>;
}) {
  const { stateSlug, citySlug } = await params;
  const city = getCity(stateSlug, citySlug);
  if (!city) notFound();


  // Live storefront Top 10 - identical products, names, sizes, and prices to
  // the default store. Empty array on failure → CityPage falls back to the
  // static FEATURED_PEPTIDES list.
  const top10 = await getStoreTop10();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
          { '@type': 'ListItem', position: 2, name: 'Peptides By City', item: 'https://pepnationlab.com/peptides' },
          { '@type': 'ListItem', position: 3, name: city.state, item: `https://pepnationlab.com/peptides/${stateSlug}` },
          { '@type': 'ListItem', position: 4, name: city.name, item: `https://pepnationlab.com/peptides/${stateSlug}/${citySlug}` },
        ],
      },
      // Service (not MedicalBusiness/LocalBusiness): Pep Nation Lab is a
      // research supply distributor with no physical premises in this city.
      // Claiming a local business with a PostalAddress here would be
      // misleading structured data (manual-action risk). Service + areaServed
      // accurately describes remote coverage of the city.
      {
        '@type': 'Service',
        '@id': `https://pepnationlab.com/peptides/${stateSlug}/${citySlug}#service`,
        serviceType: 'Research Peptide Supply',
        name: `Research Peptide Supply - ${city.name}, ${city.stateAbbr}`,
        url: `https://pepnationlab.com/peptides/${stateSlug}/${citySlug}`,
        description: `Research-grade peptide supply for qualified researchers in ${city.name}, ${city.state}. In vitro laboratory use only. Verified researcher accounts required.`,
        provider: { '@id': 'https://pepnationlab.com/#organization' },
        areaServed: {
          '@type': 'City',
          name: city.name,
          // Entity disambiguation: ties this City node to its Wikipedia
          // entry so search engines resolve the exact municipality.
          sameAs: encodeURI(
            `https://en.wikipedia.org/wiki/${city.name.replace(/ /g, '_')},_${city.state.replace(/ /g, '_')}`
          ),
          containedInPlace: {
            '@type': 'State',
            name: city.state,
          },
        },
        audience: {
          '@type': 'Audience',
          audienceType: 'Qualified Researchers And Scientific Institutions',
        },
      },
      // Top 10 compounds rendered on this page - mirrors the live storefront,
      // gives crawlers and answer engines an enumerable product list.
      ...(top10.length > 0
        ? [
            {
              '@type': 'ItemList',
              name: `Top 10 Research Compounds - ${city.name}, ${city.stateAbbr}`,
              numberOfItems: top10.length,
              itemListElement: top10.map((p, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: p.subtitle ? `${p.name} (${p.subtitle})` : p.name,
                url: `https://pepnationlab.com/${DEFAULT_STORE_SLUG}?product=${p.productId}`,
              })),
            },
            ...top10
              .filter((p) => String(p.name || '').trim() !== '')
              .map((p) => {
                const name = p.subtitle ? `${p.name} (${p.subtitle})` : p.name;
                const node: Record<string, unknown> = {
                  '@type': 'Product',
                  // name is REQUIRED by Google's Product spec — never omit it.
                  name,
                  description: `Research-grade ${p.name} for qualified researchers.`,
                  brand: { '@id': 'https://pepnationlab.com/#organization' },
                };
                if (p.image) node.image = `https://pepnationlab.com${p.image}`;
                const price = Number(p.price);
                if (Number.isFinite(price) && price > 0) {
                  node.offers = {
                    '@type': 'Offer',
                    price: price.toFixed(2),
                    priceCurrency: 'USD',
                    availability: 'https://schema.org/InStock',
                    url: `https://pepnationlab.com/${DEFAULT_STORE_SLUG}?product=${p.productId}`,
                    seller: { '@id': 'https://pepnationlab.com/#organization' },
                  };
                }
                return node;
              }),
          ]
        : []),
      {
        '@type': 'WebPage',
        '@id': `https://pepnationlab.com/peptides/${stateSlug}/${citySlug}`,
        url: `https://pepnationlab.com/peptides/${stateSlug}/${citySlug}`,
        name: `Peptide Research In ${city.name}, ${city.stateAbbr}`,
        isPartOf: { '@id': 'https://pepnationlab.com/#website' },
        publisher: { '@id': 'https://pepnationlab.com/#organization' },
        datePublished: '2026-07-01',
        dateModified: CITY_CONTENT_UPDATED.toISOString().slice(0, 10),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CityPage city={city} stateSlug={stateSlug} citySlug={citySlug} top10={top10} />
    </>
  );
}
