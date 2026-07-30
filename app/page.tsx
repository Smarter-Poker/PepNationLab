import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import HomeClient from './HomeClient';
import HomeSeoContent from '@/components/HomeSeoContent';
import AgentLinkCapture from '@/components/AgentLinkCapture';
import { REF_LOCK_COOKIE, verifyRefLock } from '@/lib/ref-lock';

export const metadata: Metadata = {
  title: 'Pep Nation Lab | Premium Research Peptide Distribution',
  description: 'Wholesale research peptide distribution for qualified researchers. Access 300+ compounds including BPC-157, TB-500, Semaglutide, and Tirzepatide. Research use only.',
  keywords: 'research peptides, BPC-157, TB-500, Semaglutide, Tirzepatide, peptide wholesale, research grade peptides, RUO compounds, peptide distribution platform',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com' },
  openGraph: {
    title: 'Pep Nation Lab | Premium Research Peptide Distribution',
    description: 'Access 300+ research-grade peptides. Wholesale pricing for qualified researchers. Full research library, calculators, and AI match engine included.',
    url: 'https://pepnationlab.com',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Pep Nation Lab - Premium Research Peptide Distribution' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pep Nation Lab | Premium Research Peptide Distribution',
    description: 'Access 300+ research-grade peptides. Wholesale pricing for qualified researchers.',
    images: ['/og-card.png'],
  },
};

export default async function HomePage() {
  // Guests who scanned an agent QR carry the signed referral-lock cookie set by
  // the middleware. Reading it here (which makes this page dynamic) lets the
  // hitmap send "Continue As Guest" to that agent's storefront and carry the
  // referral code into sign-up (see lib/ref-lock.ts).
  const cookieStore = await cookies();
  const lock = await verifyRefLock(cookieStore.get(REF_LOCK_COOKIE)?.value);
  const guestStoreSlug = lock?.s ?? null;
  const refCode = lock?.c ?? null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebPage',
              '@id': 'https://pepnationlab.com/#webpage',
              url: 'https://pepnationlab.com',
              name: 'Pep Nation Lab | Premium Research Peptide Distribution',
              description: 'Wholesale research peptide distribution for qualified researchers. Access 300+ compounds including BPC-157, TB-500, Semaglutide, and Tirzepatide. Research use only.',
              isPartOf: { '@id': 'https://pepnationlab.com/#website' },
              about: { '@id': 'https://pepnationlab.com/#organization' },
              publisher: { '@id': 'https://pepnationlab.com/#organization' },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' }
              ]
            }
          ]
        }) }}
      />
      {/* Capture guest QR / sub-agent attribution carried via ?agent / ?sa
          through the storefront guest redirect (invisible; no-op without ?agent). */}
      <AgentLinkCapture />
      <HomeClient guestStoreSlug={guestStoreSlug} refCode={refCode} />
      {/* Server-rendered crawlable homepage content: gives the root domain a
          real H1, intro copy, and descriptive internal links beneath the
          image-based landing artwork. */}
      <HomeSeoContent />
    </>
  );
}
