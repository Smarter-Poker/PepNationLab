import type { Metadata } from 'next';
import Link from 'next/link';
import { GUIDES, GUIDES_UPDATED } from '@/lib/research/guides';

export const metadata: Metadata = {
  title: 'Research Peptide Guides | Pep Nation Lab',
  description:
    'Authored, in-depth guides on research peptides: Research Use Only compliance, reading a Certificate of Analysis, storage and reconstitution, and the research-versus-pharmaceutical distinction.',
  alternates: { canonical: 'https://pepnationlab.com/research/guides' },
  openGraph: {
    title: 'Research Peptide Guides | Pep Nation Lab',
    description:
      'In-depth, RUO-compliant guides for qualified researchers: COAs, purity, storage, reconstitution, and regulatory context.',
    url: 'https://pepnationlab.com/research/guides',
    siteName: 'Pep Nation Lab',
    type: 'website',
    locale: 'en_US',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Pep Nation Lab - Research Guides' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Research Peptide Guides | Pep Nation Lab',
    description: 'In-depth, RUO-compliant guides for qualified researchers.',
    images: ['/og-card.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1 },
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
        { '@type': 'ListItem', position: 2, name: 'Research Library', item: 'https://pepnationlab.com/research' },
        { '@type': 'ListItem', position: 3, name: 'Guides', item: 'https://pepnationlab.com/research/guides' },
      ],
    },
    {
      '@type': 'CollectionPage',
      name: 'Research Peptide Guides',
      url: 'https://pepnationlab.com/research/guides',
      description: 'Authored, in-depth guides on research peptides for qualified researchers.',
      isPartOf: { '@id': 'https://pepnationlab.com/#website' },
      publisher: { '@id': 'https://pepnationlab.com/#organization' },
      dateModified: GUIDES_UPDATED,
    },
    {
      '@type': 'ItemList',
      name: 'Research Peptide Guides',
      numberOfItems: GUIDES.length,
      itemListElement: GUIDES.map((g, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: g.title,
        url: `https://pepnationlab.com/research/guides/${g.slug}`,
      })),
    },
  ],
};

export default function GuidesHubPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div style={{ background: 'var(--black)', minHeight: '100dvh' }}>
        <section className="hero-bg" style={{ position: 'relative', overflow: 'hidden', paddingTop: 'clamp(80px, 12vw, 140px)', paddingBottom: 'clamp(50px, 7vw, 90px)' }}>
          <div className="container" style={{ position: 'relative', zIndex: 1 }}>
            <nav aria-label="Breadcrumb" style={{ marginBottom: 'var(--space-6)' }}>
              <ol style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', listStyle: 'none', padding: 0, margin: 0 }}>
                <li><Link href="/" style={{ fontSize: '0.8rem', color: 'var(--grey-400)' }}>Home</Link></li>
                <li style={{ color: 'var(--grey-600)', fontSize: '0.7rem' }}>›</li>
                <li><Link href="/research" style={{ fontSize: '0.8rem', color: 'var(--grey-400)' }}>Research Library</Link></li>
                <li style={{ color: 'var(--grey-600)', fontSize: '0.7rem' }}>›</li>
                <li><span style={{ fontSize: '0.8rem', color: 'var(--teal)' }}>Guides</span></li>
              </ol>
            </nav>

            <div className="badge badge-teal" style={{ marginBottom: 'var(--space-5)', fontSize: '0.68rem' }}>Research Library</div>
            <h1 className="glow-teal" style={{ color: 'var(--white)', maxWidth: 720, marginBottom: 'var(--space-5)' }}>
              Research Peptide <span style={{ color: 'var(--teal)' }}>Guides</span>
            </h1>
            <p style={{ fontSize: '1.05rem', maxWidth: 640, color: 'var(--silver-light)', lineHeight: 1.75 }}>
              In-depth, plain-language guides written for qualified researchers. Every guide is framed strictly around in vitro Research Use Only context - regulatory background, quality documentation, and laboratory handling principles.
            </p>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 'var(--space-14)', paddingBottom: 'var(--space-20)' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-5)' }}>
              {GUIDES.map((g) => (
                <Link key={g.slug} href={`/research/guides/${g.slug}`} style={{ textDecoration: 'none' }}>
                  <article className="card" style={{ padding: 'var(--space-6)', height: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--grey-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {g.readingTimeMin} Min Read
                    </div>
                    <h2 style={{ color: 'var(--teal)', fontSize: '1.15rem', margin: 0, lineHeight: 1.3 }}>{g.title}</h2>
                    <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem', lineHeight: 1.65, margin: 0, flex: 1 }}>{g.description}</p>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--teal)', fontSize: '0.82rem', fontWeight: 700, paddingTop: 'var(--space-2)' }}>
                      Read Guide
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </span>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <footer style={{ background: 'var(--black)', borderTop: '1px solid rgba(192,184,168,0.06)', padding: 'var(--space-6) 0' }}>
          <div className="container" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              {[
                { label: 'Home', href: '/' },
                { label: 'Research Library', href: '/research' },
                { label: 'Peptides By City', href: '/peptides' },
                { label: 'Disclaimer', href: '/disclaimer' },
              ].map(({ label, href }) => (
                <Link key={label} href={href} style={{ fontSize: '0.78rem', color: 'var(--grey-600)', textDecoration: 'none' }}>{label}</Link>
              ))}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--grey-600)', margin: 0 }}>{new Date().getFullYear()} Pep Nation Lab LLC. All Rights Reserved.</p>
          </div>
        </footer>
      </div>
    </>
  );
}
