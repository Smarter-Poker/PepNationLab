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
import { CITIES, getCity } from '@/lib/cities/cities-data';
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
  const description = `Pep Nation Lab supplies research-grade peptides to qualified researchers in ${city.name}, ${city.state}. BPC-157, Semaglutide, Tirzepatide, TB-500 & 300+ more. Wholesale pricing. Verified accounts only.`;

  return {
    title,
    description,
    keywords: [
      `peptide therapy ${city.name}`,
      `research peptides ${city.name} ${city.stateAbbr}`,
      `BPC-157 ${city.name}`,
      `semaglutide ${city.name}`,
      `tirzepatide ${city.name}`,
      `TB-500 ${city.name}`,
      `weight loss peptides ${city.name}`,
      `peptide clinic ${city.name}`,
      `anti-aging peptides ${city.name} ${city.stateAbbr}`,
      `research peptides ${city.state}`,
    ].join(', '),
    alternates: {
      canonical: `https://pepnationlab.com/peptides/${stateSlug}/${citySlug}`,
    },
    openGraph: {
      title,
      description,
      url: `https://pepnationlab.com/peptides/${stateSlug}/${citySlug}`,
      siteName: 'Pep Nation Lab',
      type: 'website',
      images: [{ url: '/og-card.png', width: 1200, height: 630, alt: title }],
    },
    robots: { index: true, follow: true },
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
      {
        '@type': 'MedicalBusiness',
        '@id': `https://pepnationlab.com/peptides/${stateSlug}/${citySlug}#business`,
        name: `Pep Nation Lab — ${city.name} Research Peptides`,
        url: `https://pepnationlab.com/peptides/${stateSlug}/${citySlug}`,
        image: 'https://pepnationlab.com/logo-mark.svg',
        description: `Research-grade peptide supply for qualified researchers in ${city.name}, ${city.state}.`,
        areaServed: {
          '@type': 'City',
          name: city.name,
        },
        address: {
          '@type': 'PostalAddress',
          addressLocality: city.name,
          addressRegion: city.stateAbbr,
          addressCountry: 'US',
        },
        priceRange: '$$',
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
