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
    description: 'Science, transparency, and trust - research-first peptide distribution for qualified researchers.',
    images: ['/og-card.png'],
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'AboutPage',
      '@id': 'https://pepnationlab.com/about#webpage',
      url: 'https://pepnationlab.com/about',
      name: 'About Pep Nation Lab',
      description:
        'Pep Nation Lab is a research-first wholesale distributor of research-grade peptides for qualified researchers and scientific institutions. All products are strictly for in vitro laboratory research use only.',
      isPartOf: { '@id': 'https://pepnationlab.com/#website' },
      publisher: { '@id': 'https://pepnationlab.com/#organization' },
      about: { '@id': 'https://pepnationlab.com/#organization' },
      significantLink: [
        'https://pepnationlab.com/research',
        'https://pepnationlab.com/peptides',
        'https://pepnationlab.com/compliance',
        'https://pepnationlab.com/become-agent',
      ],
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
        { '@type': 'ListItem', position: 2, name: 'About', item: 'https://pepnationlab.com/about' },
      ],
    },
  ],
};

// About Page -- Renders The Supplied Artwork Exactly As Provided, With
// Invisible Click Zones Layered On Top (Same Pattern As The Landing Page).
// Image Is 1024x1536; All Hitboxes Are Percentages Of That Canvas.
//
// SEO/AEO: the artwork is a raster image, so on its own this page had no
// crawlable About copy — a serious gap because search engines and AI models
// read the About page to understand and trust the entity. We embed a
// visually-hidden (but screen-reader/crawler-accessible) <main> with the real
// About content, and give each click zone descriptive anchor text. The artwork
// is never modified.

// Visually-hidden pattern: present in the DOM + accessibility tree (read by
// crawlers/screen readers), painted 1px + clipped so it never disturbs the art.
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

      {/* Crawlable, screen-reader-accessible About content embedded over the
          image. Gives the page a real <h1> and substantive company copy that
          search engines and AI models use to understand and trust the brand —
          visually hidden so the artwork is unchanged. */}
      <main style={srOnly}>
        <h1>About Pep Nation Lab</h1>
        <p>
          Pep Nation Lab is a research-first wholesale distributor of research-grade peptides, built to
          support qualified researchers and scientific institutions with dependable access to high-quality
          Research Use Only (RUO) compounds, transparent wholesale pricing, and full documentation. Our
          work is grounded in three principles: science, transparency, and trust.
        </p>

        <h2>Our Mission</h2>
        <p>
          We exist to make legitimate research supply simple and reliable. Independent and institutional
          researchers should be able to source well-documented, batch-tested compounds without retail
          markup and without friction. Pep Nation Lab connects verified researchers with one of the
          largest catalogs of research-grade peptides in the industry, backed by rigorous quality
          documentation and fast nationwide fulfillment.
        </p>

        <h2>What We Do</h2>
        <p>
          Pep Nation Lab supplies more than 100 research-grade peptides and bioactive compounds — including
          widely studied compounds such as BPC-157, Semaglutide, Tirzepatide, TB-500, Ipamorelin, and
          CJC-1295 — exclusively to verified research accounts across all 50 US states. Every order ships
          with certificate-of-analysis (COA) documentation, and our full research library, compound
          monographs, and reconstitution calculators support the work our customers do in the lab.
        </p>

        <h2>Our Research-Use-Only Commitment</h2>
        <p>
          Every product Pep Nation Lab distributes is strictly for in vitro laboratory research and
          analytical purposes only. Our products are not intended for human or animal consumption,
          ingestion, or injection, are not FDA-approved, and are not drugs, supplements, food, or medical
          devices. We enforce a four-layer Research Use Only acknowledgment across the platform, verify
          researcher accounts, and never sell needles, syringes, or any injection delivery devices — and
          neither do our agents.
        </p>

        <h2>Who We Serve</h2>
        <p>
          Our platform is intended for qualified researchers, scientists, and institutional purchasers who
          are at least 21 years of age and have the training, facilities, and authority to handle
          research-grade compounds. Accounts are manually reviewed, and we may verify credentials before
          approving or continuing an account.
        </p>

        <h2>How It Works</h2>
        <p>
          Qualified researchers create a verified account, complete credential and identity verification,
          and then gain access to the full catalog at wholesale pricing with fast, discreet, lab-appropriate
          shipping. Pep Nation Lab also operates a nationwide agent network that provides localized support,
          education, and account management for research institutions.
        </p>

        <h2>Quality And Documentation</h2>
        <p>
          We source only from certified synthesis facilities, and every batch is tested with full COA
          documentation available for review. Reliable identity and purity data is what makes reproducible
          research possible, and it is central to how Pep Nation Lab operates.
        </p>

        <nav aria-label="Primary">
          <a href="/research">Research Library</a>
          <a href="/research/guides">Research Guides</a>
          <a href="/peptides">Peptides By City</a>
          <a href="/compliance">Compliance Policy</a>
          <a href="/become-agent">Become An Agent</a>
          <a href="/contact">Contact Us</a>
        </nav>
      </main>

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
          >
            {/* Real anchor text for crawlers; visually hidden over the art. */}
            <span style={srOnly}>{zone.label}</span>
          </a>
        ))}
      </div>
      </div>
    </>
  );
}
