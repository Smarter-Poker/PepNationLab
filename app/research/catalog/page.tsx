/**
 * Research Library index - the entry point to the PepNationLab Research section.
 * Redesigned into the futuristic "Research Intelligence Center".
 * Server component: fetches the full compound catalog, renders the full-screen layout.
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getAllCompounds } from '@/lib/compounds-server';
import ResearchBrowser from '@/components/research/ResearchBrowser';
import ResearchDock from '@/components/research/ResearchDock';
import BottomToolBar from '@/components/research/BottomToolBar';
import ResearchHero from '@/components/research/ResearchHero';
import CommandSearchBar from '@/components/research/CommandSearchBar';
import MatchEngineCards from '@/components/research/MatchEngineCards';
import ResearchAreaCards from '@/components/research/ResearchAreaCards';
import TrendingCarousel from '@/components/research/TrendingCarousel';
import ResearchEcosystemMap from '@/components/research/ResearchEcosystemMap';

export const metadata: Metadata = {
  title: 'Research Catalog | All Peptides & Compounds | Pep Nation Lab',
  description: 'Browse the complete Pep Nation Lab research catalog. All research-grade peptides and compounds with full monographs, evidence tiers, and mechanism data. Research use only.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research/catalog' },
  openGraph: {
    title: 'Research Catalog | All Peptides | Pep Nation Lab',
    description: 'Complete catalog of 300+ research-grade peptides with full monographs and evidence data.',
    url: 'https://pepnationlab.com/research/catalog',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Pep Nation Lab Research Catalog' }],
  },
};

export default async function ResearchLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const compounds = await getAllCompounds();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0C151D' }}>
      
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Dataset',
            name: 'Pep Nation Lab Research Peptide Database',
            description: 'A comprehensive database of research-grade peptides and chemical compounds for laboratory use. Includes molecular weights, sequences, and evidence tiers.',
            url: 'https://pepnationlab.com/research/catalog',
            license: 'https://pepnationlab.com/terms',
            isAccessibleForFree: true,
            creator: { '@id': 'https://pepnationlab.com/#organization' }
          })
        }}
      />

      {/* Left Dock Navigation */}
      <div style={{ flex: '0 0 240px', display: 'none' }} className="desktop-dock">
         {/* Using CSS class for hiding on mobile if needed */}
        <ResearchDock />
      </div>
      
      {/* Main Content Area */}
      <div style={{ flex: 1, padding: '0 24px', maxWidth: '1400px', margin: '0 auto', overflowX: 'hidden' }}>
        
        <ResearchHero />
        
        <CommandSearchBar initialQuery={q ?? ''} />
        
        <MatchEngineCards />
        
        <ResearchAreaCards />
        
        {/* We can include Trending and Ecosystem map here, or inside ResearchBrowser. Let's put them here before the grid */}
        <TrendingCarousel compounds={compounds} />
        
        <ResearchEcosystemMap />
        
        <div style={{ margin: '80px 0', borderTop: '1px solid rgba(255,255,255,0.1)' }} />

        <Suspense fallback={<div style={{ textAlign: 'center', padding: '40px', color: 'var(--silver, #A8B4C0)' }}>Loading Intelligence Database...</div>}>
          <ResearchBrowser compounds={compounds} />
        </Suspense>

      </div>
      
      {/* Global Utilities */}
      

      
      <style>{`
        @media (min-width: 1024px) {
          .desktop-dock {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
