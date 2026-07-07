/**
 * app/peptides/[stateSlug]/[citySlug]/page.tsx
 *
 * Local SEO city landing page.
 * URL pattern: pepnationlab.com/peptides/illinois/oak-lawn
 *
 * • generateStaticParams() → pre-renders all cities at build time
 * • generateMetadata()     → unique title/description/OG per city
 * • Inline JSON-LD schema  → BreadcrumbList + FAQPage (Server side rendered)
 * • CityPage is a 'use client' component for hover interactions
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CITIES, getCity, CITY_CONTENT_UPDATED } from '@/lib/cities/cities-data';
import { getCityFAQs } from '@/lib/cities/city-content';
import CityPage from './CityPage';

// ─── Static params (build-time pre-rendering) ─────────────────────────────
export async function generateStaticParams() {
  return CITIES.map((city) => ({
    stateSlug: city.stateSlug,
    citySlug: city.slug,
  }));
}

// ─── Per-city metadata ────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ stateSlug: string; citySlug: string }>;
}): Promise<Metadata> {
  const { stateSlug, citySlug } = await params;
  const city = getCity(stateSlug, citySlug);
  if (!city) return {};

  const title = `Peptide Research In ${city.name}, ${city.stateAbbr} — Pep Nation Lab`;
  const description = `Pep Nation Lab supplies research-grade peptides to qualified researchers in ${city.name}, ${city.state}. BPC-157, Semaglutide, Tirzepatide, TB-500 & 100+ more research compounds. Wholesale pricing. Verified accounts only.`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://pepnationlab.com/peptides/${stateSlug}/${citySlug}`,
    },
    // NOTE: no `images` here on purpose — the file-based opengraph-image.tsx
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

  const faqs = getCityFAQs(city);

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
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
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
        name: `Research Peptide Supply — ${city.name}, ${city.stateAbbr}`,
        url: `https://pepnationlab.com/peptides/${stateSlug}/${citySlug}`,
        description: `Research-grade peptide supply for qualified researchers in ${city.name}, ${city.state}. In vitro laboratory use only. Verified researcher accounts required.`,
        provider: { '@id': 'https://pepnationlab.com/#organization' },
        areaServed: {
          '@type': 'City',
          name: city.name,
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
      {
        '@type': 'WebPage',
        '@id': `https://pepnationlab.com/peptides/${stateSlug}/${citySlug}`,
        url: `https://pepnationlab.com/peptides/${stateSlug}/${citySlug}`,
        name: `Peptide Research In ${city.name}, ${city.stateAbbr}`,
        isPartOf: { '@id': 'https://pepnationlab.com/#website' },
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
      <CityPage city={city} stateSlug={stateSlug} citySlug={citySlug} />
    </>
  );
}
