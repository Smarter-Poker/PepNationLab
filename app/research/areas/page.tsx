import type { Metadata } from 'next';
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

export default function TherapeuticAreasPage() {
  return <TherapeuticAreasClient />;
}
