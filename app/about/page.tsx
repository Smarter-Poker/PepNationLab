import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Pep Nation Lab | Research Peptide Distribution Platform',
  description:
    'Pep Nation Lab is a research-first peptide distribution platform built to support qualified researchers with access to high-quality RUO compounds, transparent wholesale pricing, and unmatched service.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/about' },
  openGraph: {
    title: 'About Pep Nation Lab | Research Peptide Distribution Platform',
    description: "Science, transparency, and trust. Learn about Pep Nation Lab's mission, compliance framework, and research-only commitment.",
    url: 'https://pepnationlab.com/about',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'About Pep Nation Lab' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About Pep Nation Lab',
    description: 'Science, transparency, and trust — research-first peptide distribution for qualified researchers.',
    images: ['/og-card.png'],
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Pep Nation Lab',
  url: 'https://pepnationlab.com',
  logo: 'https://pepnationlab.com/logo-mark.svg',
  description: 'Wholesale research peptide distribution platform for qualified researchers and institutions. All products for in vitro research use only.',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    url: 'https://pepnationlab.com/contact',
  },
};

// About Page -- Renders The Supplied Artwork Exactly As Provided, With
// Invisible Click Zones Layered On Top (Same Pattern As The Landing Page).
// Image Is 1024x1536; All Hitboxes Are Percentages Of That Canvas.

type Zone = {
  href: string;
  label: string;
  top: string;
  left: string;
  width: string;
  height: string;
};

const ZONES: Zone[] = [
  // Top Navigation Bar
  { href: '/', label: 'Pep Nation Home', top: '0.8%', left: '3.4%', width: '26%', height: '3.4%' },
  { href: '/', label: 'Home', top: '1.4%', left: '46.6%', width: '5.6%', height: '2.7%' },
  { href: '/products', label: 'Products', top: '1.4%', left: '52.8%', width: '6.4%', height: '2.7%' },
  { href: '/research', label: 'Research', top: '1.4%', left: '60.2%', width: '6.6%', height: '2.7%' },
  { href: '/about', label: 'About', top: '1.4%', left: '67.9%', width: '4.8%', height: '2.7%' },
  { href: '/contact', label: 'Contact', top: '1.4%', left: '73.8%', width: '5.8%', height: '2.7%' },
  { href: '/login', label: 'Sign In', top: '1.2%', left: '85.7%', width: '11%', height: '2.9%' },

  // Hero: Our Mission Button (Scrolls To The Mission Panel In The Artwork)
  { href: '#mission-anchor', label: 'Our Mission', top: '25.0%', left: '4.6%', width: '15.6%', height: '2.7%' },

  // Ready To Get Started: Wholesale Link + Sign In Button
  { href: '/products', label: 'Wholesale Pricing', top: '76.3%', left: '61.2%', width: '6.2%', height: '1.6%' },
  { href: '/login', label: 'Sign In To Your Account', top: '77.5%', left: '43.0%', width: '14%', height: '2.6%' },

  // Compliance Badge Strip
  { href: '/disclaimer', label: 'Research Use Only Badges', top: '80.9%', left: '3.4%', width: '93.2%', height: '2.9%' },

  // Footer: Brand Block
  { href: '/', label: 'Pep Nation Lab Footer Logo', top: '85.1%', left: '3.4%', width: '24%', height: '3.0%' },
  // Footer: Research Use Only Pill
  { href: '/disclaimer', label: 'Research Use Only', top: '89.4%', left: '9.2%', width: '14.6%', height: '1.7%' },
  // Footer: Social / Contact Icons
  { href: '/contact', label: 'Contact Icons', top: '91.2%', left: '8.8%', width: '15.6%', height: '2.1%' },

  // Footer: Platform Column
  { href: '/products', label: 'Footer Products', top: '86.2%', left: '34.2%', width: '7%', height: '1.4%' },
  { href: '/dashboard', label: 'Footer Agent Dashboard', top: '87.7%', left: '34.2%', width: '10%', height: '1.4%' },
  { href: '/login', label: 'Footer Sign In', top: '89.2%', left: '34.2%', width: '6%', height: '1.4%' },

  // Footer: Legal Column
  { href: '/disclaimer', label: 'Research-Only Disclaimer', top: '86.2%', left: '52.2%', width: '13.4%', height: '1.4%' },
  { href: '/terms', label: 'Terms Of Service', top: '87.7%', left: '52.2%', width: '9.6%', height: '1.4%' },
  { href: '/privacy', label: 'Privacy Policy', top: '89.2%', left: '52.2%', width: '8.6%', height: '1.4%' },
  { href: '/compliance', label: 'Compliance', top: '90.6%', left: '52.2%', width: '8%', height: '1.4%' },

  // Footer: Contact Column
  { href: '/contact', label: 'Email Support', top: '86.2%', left: '73.7%', width: '17.4%', height: '1.4%' },

  // Bottom Red Disclaimer Box
  { href: '/disclaimer', label: 'Research Use Only Disclaimer', top: '93.5%', left: '3.4%', width: '93.2%', height: '3.6%' },
];

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <div style={{ backgroundColor: '#020617', minHeight: '100dvh', display: 'flex', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '1024px', margin: '0 auto' }}>
        <img
          src="https://ydsaqnnuwyvtyxgvrnys.supabase.co/storage/v1/object/public/storefront-assets/about/pep-nation-about.png"
          alt="About Pep Nation Lab -- Science, Transparency, Trust. Our Mission, What We Do, And Our Research-Only Commitment"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
        {/* Invisible Scroll Target For The Our Mission Button (Mission Panel Region Of The Artwork) */}
        <div id="mission-anchor" style={{ position: 'absolute', top: '28.6%', left: 0, width: 1, height: 1 }} />
        {ZONES.map(zone => (
          <a
            key={`${zone.label}-${zone.top}`}
            href={zone.href}
            aria-label={zone.label}
            title={zone.label}
            style={{
              position: 'absolute',
              top: zone.top,
              left: zone.left,
              width: zone.width,
              height: zone.height,
              cursor: 'pointer',
              zIndex: 10,
            }}
          />
        ))}
      </div>
      </div>
    </>
  );
}
