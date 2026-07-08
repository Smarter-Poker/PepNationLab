import type { Metadata } from 'next';
import { RESEARCH_AREAS } from '@/lib/compounds';
import TherapeuticAreasClient from './TherapeuticAreasClient';

export const metadata: Metadata = {
  title: 'Research Areas | Peptides By Therapeutic Category | Pep Nation Lab',
  description: 'Browse research peptides organized by therapeutic area. Explore weight management, tissue repair, cognitive, gut health, immune, longevity, skin/hair, and more. Research use only.',
  keywords: 'peptides by therapeutic area, weight management peptides, tissue repair peptides, cognitive peptides, gut health peptides, immune peptides, longevity peptides, research peptide categories',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research/areas' },
  openGraph: {
    title: 'Research Areas | Peptides By Therapeutic Category | Pep Nation Lab',
    description: 'Explore research peptides by therapeutic area including weight management, tissue repair, cognitive function, gut health, and more.',
    url: 'https://pepnationlab.com/research/areas',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Pep Nation Lab Therapeutic Research Areas' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Research Areas | Pep Nation Lab',
    description: 'Browse research peptides by therapeutic category - weight management, cognitive, gut health, longevity, and more.',
    images: ['/og-card.png'],
  },
};

// Visually-hidden pattern: present in the DOM + accessibility tree (read by
// crawlers/screen readers), painted 1px + clipped so it never disturbs the
// image-based visual design.
const srOnly: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export default function TherapeuticAreasPage() {
  const areaKeys = Object.keys(RESEARCH_AREAS);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'CollectionPage',
              '@id': 'https://pepnationlab.com/research/areas#webpage',
              url: 'https://pepnationlab.com/research/areas',
              name: 'Research Areas | Peptides By Therapeutic Category | Pep Nation Lab',
              description: 'Browse research peptides organized by therapeutic area: weight management, tissue repair, cognitive, gut health, immune, longevity, skin/hair, and more.',
              isPartOf: { '@id': 'https://pepnationlab.com/#website' },
              publisher: { '@id': 'https://pepnationlab.com/#organization' },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
                { '@type': 'ListItem', position: 2, name: 'Research Library', item: 'https://pepnationlab.com/research' },
                { '@type': 'ListItem', position: 3, name: 'Research Areas', item: 'https://pepnationlab.com/research/areas' },
              ],
            },
          ],
        }) }}
      />

      {/* Server-rendered, crawlable header. The visual page below is an image
          header + image-card grid, so this supplies the real <h1>, an intro,
          and a text index of every therapeutic area — visually hidden so the
          artwork-led design is unchanged. */}
      <header style={srOnly}>
        <h1>Research Peptides By Therapeutic Area</h1>
        <p>
          Browse the Pep Nation Lab research library by therapeutic research area. Each area groups the
          research-grade peptides most studied for that category of in vitro laboratory research — from
          weight management and tissue repair to cognitive, gut health, immune, longevity, and skin and
          hair research. All compounds are for Research Use Only.
        </p>
        <nav aria-label="Therapeutic Research Areas">
          <ul>
            {areaKeys.map((key) => (
              <li key={key}>
                <a href={`/research/area/${key}`}>{RESEARCH_AREAS[key].label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <TherapeuticAreasClient />
    </>
  );
}
