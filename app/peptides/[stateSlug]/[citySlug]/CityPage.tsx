'use client';

/**
 * CityPage.tsx — Client component for the city landing page.
 * Receives pre-resolved city data from the server page shell.
 */

import Link from 'next/link';
import Image from 'next/image';
import { CITIES } from '@/lib/cities/cities-data';
import type { City } from '@/lib/cities/cities-data';
import { FEATURED_PEPTIDES } from '@/lib/cities/keywords';
import { getCityIntro, getCityFAQs, VALUE_PROPS, getRegionLabel } from '@/lib/cities/city-content';

// ─── Icon SVG lookup maps (no emojis — platform rule) ────────────────────
const PEPTIDE_ICON_SVG: Record<string, React.ReactNode> = {
  FlaskConical: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5"><path d="M6 3h12"/><path d="M9 3v6l-5 9a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-5-9V3"/></svg>,
  Beaker:       <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5"><path d="M4.5 3h15"/><path d="M6 3v10l-2.8 6.4A1 1 0 0 0 4.1 21h15.8a1 1 0 0 0 .9-1.6L18 13V3"/><path d="M6 17h12"/></svg>,
  Syringe:      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5"><path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/></svg>,
  Microscope:   <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5"><path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/></svg>,
  TestTube:     <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5"><path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5c-1.4 0-2.5-1.1-2.5-2.5V2"/><path d="M8.5 2h7"/><path d="M14.5 16h-5"/></svg>,
  Telescope:    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5"><circle cx="12" cy="12" r="2"/><path d="M4 12 2 2l4 1 5 9"/><path d="m20 12 2-10-4 1-5 9"/><path d="M10.5 20.5 10 22l2 1 2-1-.5-1.5"/><path d="M12 19v-6.5"/></svg>,
  Thermometer:  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>,
  Pill:         <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="M8.5 8.5 16 16"/></svg>,
};

const VALUE_ICON_SVG: Record<string, React.ReactNode> = {
  Dna:            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5"><path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/><path d="m17 6-2.5-2.5"/><path d="m14 8-1-1"/><path d="m7 18 2.5 2.5"/><path d="m10 16 1 1"/><path d="m2 9 4.5 4.5"/><path d="m21.5 10.5-1 1"/><path d="m22 15-4.5-4.5"/><path d="m2.5 13.5 1-1"/></svg>,
  Zap:            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>,
  BadgeDollarSign:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>,
  FlaskConical:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5"><path d="M6 3h12"/><path d="M9 3v6l-5 9a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-5-9V3"/></svg>,
  Shield:         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>,
  Package:        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/><path d="m7.5 4.27 9 5.15"/></svg>,
};

interface Props {
  city: City;
  stateSlug: string;
  citySlug: string;
}

export default function CityPage({ city, stateSlug, citySlug }: Props) {
  const intro = getCityIntro(city);
  const faqs = getCityFAQs(city);
  const region = getRegionLabel(city);

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
          { '@type': 'ListItem', position: 2, name: 'Peptides by City', item: 'https://pepnationlab.com/peptides' },
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
        '@type': 'Organization',
        name: 'Pep Nation Lab',
        url: 'https://pepnationlab.com',
        description: `Wholesale research peptide distribution serving ${city.name}, ${city.state} and nationwide.`,
        areaServed: city.name,
        contactPoint: { '@type': 'ContactPoint', email: 'support@pepnationlab.com', contactType: 'customer service' },
      },
    ],
  };

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <style>{`
        .city-link:hover { color: var(--teal) !important; }
        .city-pill:hover { color: var(--teal) !important; border-color: rgba(192,184,168,0.3) !important; }
        .crumb-link:hover { color: var(--teal) !important; }
        .peptide-card:hover {
          border-color: rgba(192,184,168,0.4) !important;
          transform: translateY(-3px);
          box-shadow: var(--shadow-teal) !important;
        }
        .footer-link:hover { color: var(--teal) !important; }
        details[open] summary svg { transform: rotate(180deg); }
        details summary::-webkit-details-marker { display: none; }
      `}</style>

      <div style={{ background: 'var(--black)', minHeight: '100dvh' }}>

        {/* ── HERO ─────────────────────────────────────────────────── */}
        <section className="hero-bg" style={{
          position: 'relative',
          overflow: 'hidden',
          paddingTop: 'clamp(80px, 12vw, 140px)',
          paddingBottom: 'clamp(60px, 8vw, 100px)',
        }}>
          {/* Decorative orbit rings */}
          <div aria-hidden style={{
            position: 'absolute', top: '50%', right: '-8%',
            transform: 'translateY(-50%)',
            width: 560, height: 560,
            borderRadius: '50%',
            border: '1px solid rgba(192,184,168,0.07)',
            pointerEvents: 'none',
          }}>
            <div style={{ position: 'absolute', inset: 50, borderRadius: '50%', border: '1px solid rgba(192,184,168,0.05)' }} />
            <div style={{ position: 'absolute', inset: 120, borderRadius: '50%', border: '1px solid rgba(192,184,168,0.03)' }} />
          </div>

          <div className="container" style={{ position: 'relative', zIndex: 1 }}>

            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" style={{ marginBottom: 'var(--space-6)' }}>
              <ol style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', listStyle: 'none', padding: 0, margin: 0 }}>
                {[
                  { label: 'Home', href: '/' },
                  { label: 'Peptides by City', href: '/peptides' },
                  { label: city.state, href: `/peptides/${stateSlug}` },
                  { label: city.name, href: null },
                ].map((crumb, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {i > 0 && <span style={{ color: 'var(--grey-600)', fontSize: '0.7rem' }}>›</span>}
                    {crumb.href ? (
                      <Link href={crumb.href} className="crumb-link" style={{ fontSize: '0.8rem', color: 'var(--grey-400)', transition: 'color 0.2s', textDecoration: 'none' }}>
                        {crumb.label}
                      </Link>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--teal)' }}>{crumb.label}</span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>

            {/* Badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
              <span className="badge badge-teal" style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 3h12"/><path d="M9 3v6l-5 9a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-5-9V3"/>
                </svg>
                Research Use Only
              </span>
              <span className="badge badge-silver" style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                {city.name}, {city.stateAbbr}
              </span>
              {city.tier === 1 && (
                <span className="badge" style={{ fontSize: '0.68rem', background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.25)', color: 'var(--gold)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  Priority Market
                </span>
              )}
            </div>

            {/* H1 */}
            <h1 className="glow-teal" style={{ marginBottom: 'var(--space-5)', color: 'var(--white)', maxWidth: 720 }}>
              Peptide Research in{' '}
              <span style={{ color: 'var(--teal)' }}>{city.name}, {city.stateAbbr}</span>
            </h1>

            {/* Intro paragraph */}
            <p style={{
              fontSize: '1.05rem',
              maxWidth: 640,
              color: 'var(--silver-light)',
              lineHeight: 1.75,
              marginBottom: 'var(--space-7)',
            }}>
              {intro}
            </p>

            {/* RUO warning strip */}
            <div style={{
              background: 'rgba(229,62,62,0.06)',
              border: '1px solid rgba(229,62,62,0.2)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-4)',
              marginBottom: 'var(--space-8)',
              display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
              maxWidth: 640,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <p style={{ fontSize: '0.78rem', color: 'var(--silver)', margin: 0, lineHeight: 1.6 }}>
                All products are <strong style={{ color: 'var(--red)' }}>strictly for in vitro research use only</strong> — not for human or animal consumption. Qualified researchers only.
              </p>
            </div>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <Link href="/login" className="btn btn-primary btn-xl">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                Access the Lab
              </Link>
              <Link href="/research" className="btn btn-secondary btn-xl">
                Browse Research Library
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Link>
            </div>

            {/* Stats */}
            <div style={{
              display: 'flex', gap: 'var(--space-8)', marginTop: 'var(--space-12)',
              paddingTop: 'var(--space-8)',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              flexWrap: 'wrap',
            }}>
              {[
                { num: '300+', label: 'Research Compounds' },
                { num: '50 States', label: 'Nationwide Shipping' },
                { num: '3 Tiers', label: 'Wholesale Pricing' },
                { num: '100%', label: 'Verified Accounts' },
              ].map(({ num, label }) => (
                <div key={label}>
                  <div style={{
                    fontFamily: 'var(--font-brand)', fontSize: '1.6rem', fontWeight: 800,
                    color: 'var(--teal)', textShadow: '0 0 20px rgba(192,184,168,0.35)',
                  }}>{num}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURED PEPTIDES GRID ────────────────────────────────── */}
        <section className="section" style={{ background: 'var(--black-2)', paddingTop: 'var(--space-20)', paddingBottom: 'var(--space-20)' }}>
          <div className="container">
            <div style={{ marginBottom: 'var(--space-12)', textAlign: 'center' }}>
              <div className="badge badge-teal" style={{ marginBottom: 'var(--space-4)', fontSize: '0.7rem' }}>
                Research Catalog
              </div>
              <h2 style={{ color: 'var(--white)', marginBottom: 'var(--space-4)' }}>
                Top Researched Peptides Near{' '}
                <span style={{ color: 'var(--teal)' }}>{city.name}</span>
              </h2>
              <p style={{ color: 'var(--grey-400)', fontSize: '0.95rem', maxWidth: 560, margin: '0 auto' }}>
                Explore our most in-demand research compounds. Each is available at wholesale pricing for verified researchers in {city.name}, {city.stateAbbr} and nationwide.
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 'var(--space-5)',
            }}>
              {FEATURED_PEPTIDES.map((peptide) => (
                <Link
                  key={peptide.slug}
                  href={`/research/${peptide.slug}`}
                  className="peptide-card card"
                  style={{
                    textDecoration: 'none',
                    padding: 'var(--space-6)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-3)',
                    transition: 'all 0.25s ease',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {peptide.badge && (
                    <div style={{
                      position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)',
                      background: 'rgba(0,229,255,0.08)',
                      border: '1px solid rgba(0,229,255,0.2)',
                      borderRadius: 'var(--radius-full)',
                      padding: '2px 10px',
                      fontSize: '0.62rem', color: 'var(--gold)',
                      fontWeight: 600, letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}>
                      {peptide.badge}
                    </div>
                  )}
                  <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-1)' }}>
                    {PEPTIDE_ICON_SVG[(peptide as any).icon] ?? PEPTIDE_ICON_SVG.FlaskConical}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                      {peptide.category}
                    </div>
                    <h3 style={{ color: 'var(--teal)', fontSize: '1.15rem', margin: 0 }}>{peptide.name}</h3>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', lineHeight: 1.65, margin: 0, flex: 1 }}>
                    {peptide.description || (peptide as any).tagline}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--teal)', fontSize: '0.8rem', fontWeight: 600, marginTop: 'var(--space-2)' }}>
                    View Research
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </div>
                </Link>
              ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: 'var(--space-10)' }}>
              <Link href="/research/a-z" className="btn btn-secondary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                Browse Full A–Z Research Catalog
              </Link>
            </div>
          </div>
        </section>

        {/* ── WHY PEP NATION LAB ────────────────────────────────────── */}
        <section className="section" style={{ paddingTop: 'var(--space-20)', paddingBottom: 'var(--space-20)' }}>
          <div className="container">
            <div style={{ marginBottom: 'var(--space-12)', textAlign: 'center' }}>
              <div className="badge badge-silver" style={{ marginBottom: 'var(--space-4)', fontSize: '0.7rem' }}>
                Why Researchers Choose Us
              </div>
              <h2 style={{ color: 'var(--white)', marginBottom: 'var(--space-4)' }}>
                The {region}&apos;s Trusted Source for{' '}
                <span style={{ color: 'var(--teal)' }}>Research Peptides</span>
              </h2>
              <p style={{ color: 'var(--grey-400)', fontSize: '0.95rem', maxWidth: 540, margin: '0 auto' }}>
                Researchers in {city.name} choose Pep Nation Lab for one reason — we make quality research accessible at prices that scale with your lab.
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 'var(--space-5)',
            }}>
              {VALUE_PROPS.map((vp) => (
                <div key={vp.title} style={{
                  background: 'var(--surface-1)',
                  border: 'var(--border-subtle)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-6)',
                  display: 'flex', gap: 'var(--space-4)',
                }}>
                  <div style={{
                    width: 48, height: 48, flexShrink: 0,
                    background: 'var(--teal-subtle)',
                    border: 'var(--border-teal)',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.4rem',
                  }}>
                    {VALUE_ICON_SVG[vp.icon] ?? VALUE_ICON_SVG.FlaskConical}
                  </div>
                  <div>
                    <h4 style={{ color: 'var(--silver-light)', marginBottom: 'var(--space-2)', fontSize: '0.95rem' }}>{vp.title}</h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', lineHeight: 1.65, margin: 0 }}>{vp.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── AGENT NETWORK CTA ─────────────────────────────────────── */}
        <section style={{
          background: 'var(--surface-1)',
          borderTop: 'var(--border-subtle)',
          borderBottom: 'var(--border-subtle)',
          padding: 'var(--space-16) 0',
        }}>
          <div className="container">
            <div style={{
              background: 'linear-gradient(135deg, rgba(192,184,168,0.06) 0%, rgba(0,0,0,0) 60%)',
              border: 'var(--border-teal)',
              borderRadius: 'var(--radius-2xl)',
              padding: 'clamp(32px, 5vw, 56px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--space-8)',
            }}>
              <div style={{ maxWidth: 560 }}>
                <div className="badge badge-teal" style={{ marginBottom: 'var(--space-4)', fontSize: '0.68rem' }}>
                  {region} Agent Network
                </div>
                <h2 style={{ color: 'var(--white)', marginBottom: 'var(--space-4)', fontSize: 'clamp(1.4rem, 3vw, 2rem)' }}>
                  Serve Researchers in <span style={{ color: 'var(--teal)' }}>{city.name}</span>
                </h2>
                <p style={{ color: 'var(--grey-400)', lineHeight: 1.7, marginBottom: 0, fontSize: '0.92rem' }}>
                  Join the Pep Nation Lab agent network and build your business in the {region} area. Earn recurring commissions by connecting qualified researchers with premium compounds at wholesale pricing.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                <Link href="/become-agent" className="btn btn-primary btn-xl">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  Become an Agent
                </Link>
                <Link href="/login" style={{ fontSize: '0.82rem', color: 'var(--grey-400)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                  Already an agent? Sign in →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────── */}
        <section className="section" style={{ paddingTop: 'var(--space-20)', paddingBottom: 'var(--space-20)' }}>
          <div className="container" style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ marginBottom: 'var(--space-12)', textAlign: 'center' }}>
              <div className="badge badge-silver" style={{ marginBottom: 'var(--space-4)', fontSize: '0.7rem' }}>
                Common Questions
              </div>
              <h2 style={{ color: 'var(--white)', marginBottom: 'var(--space-4)' }}>
                Peptide Research in{' '}
                <span style={{ color: 'var(--teal)' }}>{city.name}, {city.stateAbbr}</span>
              </h2>
              <p style={{ color: 'var(--grey-400)', fontSize: '0.92rem' }}>
                Answers to the most common questions from researchers in {city.name} and the {region} area.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {faqs.map((faq, i) => (
                <details key={i} style={{
                  background: 'var(--surface-1)',
                  border: 'var(--border-subtle)',
                  borderRadius: 'var(--radius-xl)',
                  overflow: 'hidden',
                }}>
                  <summary style={{
                    padding: 'var(--space-5) var(--space-6)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    color: 'var(--silver-light)',
                    listStyle: 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                  }}>
                    <span>{faq.question}</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" style={{ flexShrink: 0, transition: 'transform 0.2s' }}>
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </summary>
                  <div style={{
                    padding: '0 var(--space-6) var(--space-5)',
                    borderTop: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <p style={{ fontSize: '0.88rem', color: 'var(--grey-400)', lineHeight: 1.75, margin: 0, paddingTop: 'var(--space-4)' }}>
                      {faq.answer}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────────────── */}
        <section style={{
          background: 'var(--black-2)',
          borderTop: 'var(--border-subtle)',
          padding: 'var(--space-20) 0',
          textAlign: 'center',
        }}>
          <div className="container" style={{ maxWidth: 620 }}>
            <div style={{ width: 56, height: 56, margin: '0 auto var(--space-4)', background: 'var(--teal-subtle)', border: 'var(--border-teal)', borderRadius: 'var(--radius-xl)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5">
                <path d="M6 3h12"/><path d="M9 3v6l-5 9a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-5-9V3"/>
              </svg>
            </div>
            <h2 style={{ color: 'var(--white)', marginBottom: 'var(--space-4)' }}>
              Ready to Start Your Research in{' '}
              <span style={{ color: 'var(--teal)' }}>{city.name}?</span>
            </h2>
            <p style={{ color: 'var(--grey-400)', lineHeight: 1.7, marginBottom: 'var(--space-8)', fontSize: '0.95rem' }}>
              Create a verified researcher account today and unlock wholesale pricing on 300+ pharmaceutical-grade peptides — shipped fast to {city.name}, {city.stateAbbr}.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/login" className="btn btn-primary btn-xl">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                Access the Lab
              </Link>
              <Link href="/research" className="btn btn-secondary btn-xl">
                Explore Research Library
              </Link>
            </div>
            <div style={{ marginTop: 'var(--space-8)', display: 'flex', justifyContent: 'center' }}>
              <Image src="/images/badges/research_use_pill_transparent.png" alt="Research Use Only" width={320} height={60} unoptimized style={{ height: 'auto', maxWidth: 320, opacity: 0.6 }} />
            </div>
          </div>
        </section>

        {/* ── NEARBY CITIES STRIP ──────────────────────────────────── */}
        <NearbyStrip stateSlug={stateSlug} currentCitySlug={citySlug} stateName={city.state} />

        {/* ── FOOTER ────────────────────────────────────────────────── */}
        <footer style={{
          background: 'var(--black)',
          borderTop: '1px solid rgba(192,184,168,0.06)',
          padding: 'var(--space-8) 0',
        }}>
          <div className="container">
            <div style={{
              background: 'var(--red-bg)',
              border: '1px solid rgba(229,62,62,0.15)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              marginBottom: 'var(--space-6)',
            }}>
              <p style={{ fontSize: '0.73rem', color: 'var(--grey-400)', lineHeight: 1.7, textAlign: 'center', margin: 0 }}>
                <strong style={{ color: 'var(--red)' }}>Research Use Only Disclaimer:</strong>{' '}
                All products sold on PepNationLab.com are strictly for <em>in vitro</em> laboratory research and analytical purposes only. They are NOT intended for human or animal consumption, ingestion, or injection. These products have not been evaluated or approved by the FDA. Purchasers assume full legal responsibility for compliance with all applicable laws.
              </p>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexWrap: 'wrap', gap: 'var(--space-4)',
            }}>
              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                {[
                  { label: 'Home', href: '/' },
                  { label: 'Research Library', href: '/research' },
                  { label: 'Peptides by City', href: '/peptides' },
                  { label: 'Disclaimer', href: '/disclaimer' },
                  { label: 'Terms', href: '/terms' },
                  { label: 'Privacy', href: '/privacy' },
                ].map(({ label, href }) => (
                  <Link key={label} href={href} className="footer-link" style={{ fontSize: '0.78rem', color: 'var(--grey-600)', textDecoration: 'none', transition: 'color 0.2s' }}>
                    {label}
                  </Link>
                ))}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--grey-600)', margin: 0 }}>
                © {new Date().getFullYear()} Pep Nation Lab LLC. All Rights Reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

// ─── Nearby cities from same state ───────────────────────────────────────
function NearbyStrip({ stateSlug, currentCitySlug, stateName }: {
  stateSlug: string; currentCitySlug: string; stateName: string;
}) {
  const nearby = CITIES
    .filter((c) => c.stateSlug === stateSlug && c.slug !== currentCitySlug)
    .sort((a, b) => b.population - a.population)
    .slice(0, 8);

  if (nearby.length === 0) return null;

  return (
    <section style={{ padding: 'var(--space-12) 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="container">
        <h3 style={{
          color: 'var(--grey-600)', fontSize: '0.75rem',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginBottom: 'var(--space-4)',
        }}>
          More cities in {stateName}
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {nearby.map((c) => (
            <Link
              key={c.slug}
              href={`/peptides/${stateSlug}/${c.slug}`}
              className="city-pill"
              style={{
                padding: '6px 14px',
                fontSize: '0.8rem',
                color: 'var(--grey-400)',
                background: 'var(--surface-1)',
                border: 'var(--border-subtle)',
                borderRadius: 'var(--radius-full)',
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
            >
              {c.name}
            </Link>
          ))}
          <Link
            href={`/peptides/${stateSlug}`}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              color: 'var(--teal)',
              background: 'var(--teal-subtle)',
              border: 'var(--border-teal)',
              borderRadius: 'var(--radius-full)',
              textDecoration: 'none',
            }}
          >
            All {stateName} cities →
          </Link>
        </div>
      </div>
    </section>
  );
}
