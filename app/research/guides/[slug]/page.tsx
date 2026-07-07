import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GUIDES, getGuide, getRelatedGuides, GUIDE_AUTHOR, GUIDE_FAQS } from '@/lib/research/guides';

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};

  const url = `https://pepnationlab.com/research/guides/${guide.slug}`;
  return {
    title: `${guide.title} | Pep Nation Lab`,
    description: guide.description,
    alternates: { canonical: url },
    openGraph: {
      title: guide.title,
      description: guide.description,
      url,
      siteName: 'Pep Nation Lab',
      type: 'article',
      locale: 'en_US',
      publishedTime: guide.datePublished,
      modifiedTime: guide.dateModified,
      images: [{ url: '/og-card.png', width: 1200, height: 630, alt: guide.title }],
    },
    twitter: { card: 'summary_large_image', title: guide.title, description: guide.description },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1 },
    },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const url = `https://pepnationlab.com/research/guides/${guide.slug}`;
  const related = getRelatedGuides(guide);
  const faqs = GUIDE_FAQS[guide.slug] ?? [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
          { '@type': 'ListItem', position: 2, name: 'Research Library', item: 'https://pepnationlab.com/research' },
          { '@type': 'ListItem', position: 3, name: 'Guides', item: 'https://pepnationlab.com/research/guides' },
          { '@type': 'ListItem', position: 4, name: guide.title, item: url },
        ],
      },
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: guide.title,
        description: guide.description,
        url,
        mainEntityOfPage: url,
        datePublished: guide.datePublished,
        dateModified: guide.dateModified,
        inLanguage: 'en-US',
        keywords: guide.keywords.join(', '),
        image: 'https://pepnationlab.com/og-card.png',
        author: { '@type': 'Organization', name: GUIDE_AUTHOR, url: 'https://pepnationlab.com' },
        publisher: { '@id': 'https://pepnationlab.com/#organization' },
        isPartOf: { '@id': 'https://pepnationlab.com/#website' },
        about: 'Research Use Only peptides for in vitro laboratory research',
        ...(guide.compounds && guide.compounds.length
          ? {
              mentions: guide.compounds.map((c) => ({
                '@type': 'ChemicalSubstance',
                name: c.name,
                url: `https://pepnationlab.com/research/${c.slug}`,
              })),
            }
          : {}),
      },
      ...(faqs.length ? [{ '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : []),
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div style={{ background: 'var(--black)', minHeight: '100dvh' }}>
        <article>
          <section className="hero-bg" style={{ position: 'relative', overflow: 'hidden', paddingTop: 'clamp(80px, 12vw, 130px)', paddingBottom: 'clamp(30px, 5vw, 56px)' }}>
            <div className="container" style={{ position: 'relative', zIndex: 1, maxWidth: 820 }}>
              <nav aria-label="Breadcrumb" style={{ marginBottom: 'var(--space-5)' }}>
                <ol style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', listStyle: 'none', padding: 0, margin: 0 }}>
                  <li><Link href="/" style={{ fontSize: '0.78rem', color: 'var(--grey-400)' }}>Home</Link></li>
                  <li style={{ color: 'var(--grey-600)', fontSize: '0.7rem' }}>›</li>
                  <li><Link href="/research" style={{ fontSize: '0.78rem', color: 'var(--grey-400)' }}>Research Library</Link></li>
                  <li style={{ color: 'var(--grey-600)', fontSize: '0.7rem' }}>›</li>
                  <li><Link href="/research/guides" style={{ fontSize: '0.78rem', color: 'var(--grey-400)' }}>Guides</Link></li>
                </ol>
              </nav>

              <h1 style={{ color: 'var(--white)', fontSize: 'clamp(1.9rem, 4vw, 3rem)', fontWeight: 900, lineHeight: 1.12, letterSpacing: '-0.02em', marginBottom: 'var(--space-4)' }}>
                {guide.title}
              </h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center', color: 'var(--grey-500)', fontSize: '0.8rem', marginBottom: 'var(--space-5)' }}>
                <span>By {GUIDE_AUTHOR}</span>
                <span>·</span>
                <time dateTime={guide.dateModified}>Updated {guide.dateModified}</time>
                <span>·</span>
                <span>{guide.readingTimeMin} Min Read</span>
              </div>
              <p style={{ color: 'var(--silver-light)', fontSize: '1.05rem', lineHeight: 1.75, margin: 0 }}>{guide.intro}</p>
            </div>
          </section>

          <section style={{ padding: 'clamp(24px, 4vw, 48px) 0 clamp(48px, 7vw, 88px)' }}>
            <div className="container" style={{ maxWidth: 820 }}>
              {/* Key takeaways — dense, quotable block for answer engines */}
              <aside className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)', borderColor: 'var(--border-teal)' }}>
                <h2 style={{ color: 'var(--teal)', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 0, marginBottom: 'var(--space-4)' }}>Key Takeaways</h2>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {guide.keyTakeaways.map((t, i) => (
                    <li key={i} style={{ color: 'var(--silver-light)', fontSize: '0.9rem', lineHeight: 1.6 }}>{t}</li>
                  ))}
                </ul>
              </aside>

              {guide.sections.map((s, i) => (
                <section key={i} style={{ marginBottom: 'var(--space-8)' }}>
                  <h2 style={{ color: 'var(--white)', fontSize: 'clamp(1.3rem, 2.4vw, 1.7rem)', fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 'var(--space-4)' }}>{s.heading}</h2>
                  {s.paragraphs.map((p, j) => (
                    <p key={j} style={{ color: 'var(--silver-light)', fontSize: '1rem', lineHeight: 1.8, marginBottom: 'var(--space-4)' }}>{p}</p>
                  ))}
                  {s.bullets && (
                    <ul style={{ margin: '0 0 var(--space-4)', paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {s.bullets.map((b, k) => (
                        <li key={k} style={{ color: 'var(--grey-300)', fontSize: '0.95rem', lineHeight: 1.7 }}>{b}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}

              {/* RUO disclaimer */}
              <div data-nosnippet style={{ background: 'rgba(229,62,62,0.05)', border: '1px solid rgba(229,62,62,0.15)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4) var(--space-5)', marginTop: 'var(--space-8)' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', lineHeight: 1.7, margin: 0 }}>
                  <strong style={{ color: 'var(--red)' }}>Research Use Only:</strong> This guide is informational and describes research-context handling of compounds intended strictly for in vitro laboratory research. Products are not for human or animal consumption, ingestion, or injection, and are not FDA-approved. Nothing here is medical, clinical, or dosing advice.
                </p>
              </div>

              {faqs.length > 0 && (
                <section style={{ marginTop: 'var(--space-10)' }}>
                  <h2 style={{ color: 'var(--white)', fontSize: 'clamp(1.3rem, 2.4vw, 1.7rem)', fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 'var(--space-5)' }}>Frequently Asked Questions</h2>
                  {faqs.map((f, i) => (
                    <div key={i} style={{ marginBottom: 'var(--space-5)' }}>
                      <h3 style={{ color: 'var(--white)', fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.4, marginBottom: 'var(--space-2)' }}>{f.q}</h3>
                      <p style={{ color: 'var(--silver-light)', fontSize: '1rem', lineHeight: 1.8, margin: 0 }}>{f.a}</p>
                    </div>
                  ))}
                </section>
              )}

              {guide.compounds && guide.compounds.length > 0 && (
                <div style={{ marginTop: 'var(--space-10)' }}>
                  <h2 style={{ color: 'var(--white)', fontSize: '1.1rem', fontWeight: 800, marginBottom: 'var(--space-4)' }}>Compounds Referenced In This Guide</h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    {guide.compounds.map((c) => (
                      <Link key={c.slug} href={`/research/${c.slug}`} className="card" style={{ padding: 'var(--space-3) var(--space-5)', textDecoration: 'none', color: 'var(--teal)', fontSize: '0.88rem', fontWeight: 600 }}>
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {related.length > 0 && (
                <div style={{ marginTop: 'var(--space-10)' }}>
                  <h2 style={{ color: 'var(--white)', fontSize: '1.1rem', fontWeight: 800, marginBottom: 'var(--space-4)' }}>Related Guides</h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    {related.map((r) => (
                      <Link key={r.slug} href={`/research/guides/${r.slug}`} className="card" style={{ padding: 'var(--space-3) var(--space-5)', textDecoration: 'none', color: 'var(--teal)', fontSize: '0.88rem', fontWeight: 600 }}>
                        {r.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </article>

        <footer style={{ background: 'var(--black)', borderTop: '1px solid rgba(192,184,168,0.06)', padding: 'var(--space-6) 0' }}>
          <div className="container" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              {[
                { label: 'All Guides', href: '/research/guides' },
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
