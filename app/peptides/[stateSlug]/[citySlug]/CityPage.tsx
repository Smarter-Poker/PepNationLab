'use client';

/**
 * CityPage.tsx
 * Premium city landing page:
 * - RUO disclaimer moved to BOTTOM of hero (after stats)
 * - Stats numbers centered over labels
 * - Dynamic section backgrounds on every section
 * - 10 featured peptides with popular name
 * - Nano Banana 3D icons for value props
 */

import Link from 'next/link';
import Image from 'next/image';
import { CITIES } from '@/lib/cities/cities-data';
import type { City } from '@/lib/cities/cities-data';
import { FEATURED_PEPTIDES } from '@/lib/cities/keywords';
import { getCityIntro, getCityFAQs, VALUE_PROPS, getRegionLabel } from '@/lib/cities/city-content';

interface Props {
  city: City;
  stateSlug: string;
  citySlug: string;
}

// Maps each value-prop icon key to its Nano Banana 3D image
const VALUE_ICON_IMAGE: Record<string, string> = {
  Dna:              '/images/icons/icon-purity.jpg',
  Zap:              '/images/icons/icon-fulfillment.jpg',
  BadgeDollarSign:  '/images/icons/icon-pricing.jpg',
  FlaskConical:     '/images/icons/icon-compounds.jpg',
  Shield:           '/images/icons/icon-verified.jpg',
  Package:          '/images/icons/icon-shipping.jpg',
};

export default function CityPage({ city, stateSlug, citySlug }: Props) {
  const intro = getCityIntro(city);
  const faqs = getCityFAQs(city);
  const region = getRegionLabel(city);

  return (
    <>

      <style>{`
        /* ── City-page scoped styles ─────────────────── */
        .city-crumb:hover { color: var(--teal) !important; }
        .city-pill:hover  { color: var(--teal) !important; border-color: rgba(192,184,168,0.35) !important; }
        .city-pcard-wrapper {
          padding: 3px;
          border-radius: 18px;
          background: linear-gradient(145deg, #c8c2b8 0%, #a09890 30%, #8a847c 50%, #a09890 70%, #c8c2b8 100%);
          box-shadow: 0 8px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.4);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .city-pcard-wrapper:hover {
          transform: translateY(-5px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.5);
        }
        .city-pcard-inner {
          background: linear-gradient(180deg, #1a1f2e 0%, #141820 40%, #111520 100%);
          border-radius: 15px;
          box-shadow: inset 0 2px 8px rgba(0,0,0,0.6);
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          position: relative;
        }
        .city-pcard-inner:hover .city-pcard-img {
          transform: scale(1.05);
        }
        .city-pcard-img {
          transition: transform 0.35s ease;
          object-fit: contain;
          max-height: 110px;
          width: auto;
        }
        .city-flink:hover { color: var(--teal) !important; }
        .city-vcard { transition: all 0.2s; }
        .city-vcard:hover {
          border-color: rgba(192,184,168,0.25) !important;
          transform: translateY(-2px);
        }
        details[open] .city-faq-chevron { transform: rotate(180deg); }
        details summary::-webkit-details-marker { display: none; }

        /* stat numbers — centered */
        .city-stat-block { text-align: center; }
        .city-stat-num {
          font-size: clamp(2rem, 4vw, 3rem);
          font-weight: 900;
          font-family: var(--font-brand);
          color: var(--teal);
          letter-spacing: -0.03em;
          line-height: 1;
        }
        .city-stat-label {
          font-size: 0.65rem;
          color: var(--grey-500);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-top: 5px;
          text-align: center;
        }

        /* RUO badge shimmer */
        @keyframes city-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .city-ruo-badge {
          background: linear-gradient(90deg, rgba(229,62,62,0.15) 0%, rgba(229,62,62,0.3) 50%, rgba(229,62,62,0.15) 100%);
          background-size: 200% auto;
          animation: city-shimmer 3s linear infinite;
        }

        /* hero glow pulse */
        @keyframes city-glow-pulse {
          0%, 100% { opacity: 0.45; }
          50%       { opacity: 0.9; }
        }
        .city-hero-glow { animation: city-glow-pulse 4s ease-in-out infinite; }

        /* scroll fade-in */
        @keyframes city-fadein {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .city-fadein { animation: city-fadein 0.75s ease forwards; }

        /* image buttons */
        .city-img-btn {
          display: inline-block;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .city-img-btn:hover {
          transform: scale(1.03);
          filter: drop-shadow(0 10px 20px rgba(0,0,0,0.4));
        }
        .city-img-btn img {
          display: block;
          height: clamp(56px, 8vw, 76px);
          width: auto;
          object-fit: contain;
        }

        /* popular name tag */
        .popular-name-tag {
          display: inline-block;
          padding: 2px 9px;
          background: rgba(192,184,168,0.06);
          border: 1px solid rgba(192,184,168,0.15);
          border-radius: var(--radius-full);
          font-size: 0.62rem;
          color: var(--grey-400);
          letter-spacing: 0.03em;
          margin-bottom: 6px;
        }
      `}</style>

      <div style={{ background: 'var(--black)', minHeight: '100dvh' }}>

        {/* ═══════════════════════════════════════════════════════════
            HERO — 3D peptide helix full-bleed
        ═══════════════════════════════════════════════════════════ */}
        <section style={{ position: 'relative', minHeight: 'clamp(640px, 95vh, 980px)', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          {/* BG image */}
          <Image src="/images/city-hero-peptide.jpg" alt="3D peptide helix" fill priority unoptimized
            style={{ objectFit: 'cover', objectPosition: 'center right', opacity: 0.75 }} />
          {/* Left gradient overlay */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, var(--black) 35%, rgba(5,10,15,0.6) 65%, transparent 100%)', zIndex: 1 }} />
          {/* Bottom fade */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 200, background: 'linear-gradient(to top, var(--black), transparent)', zIndex: 2 }} />
          {/* Teal glow orb */}
          <div className="city-hero-glow" style={{ position: 'absolute', top: '28%', left: '28%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,196,188,0.07) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 1 }} />

          {/* Content */}
          <div className="container city-fadein" style={{ position: 'relative', zIndex: 3, paddingTop: 'clamp(100px, 14vw, 160px)', paddingBottom: 'clamp(80px, 10vw, 120px)' }}>

            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" style={{ marginBottom: 'var(--space-5)' }}>
              <ol style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', listStyle: 'none', padding: 0, margin: 0 }}>
                {[
                  { label: 'Home', href: '/' },
                  { label: 'Peptides By City', href: '/peptides' },
                  { label: city.state, href: `/peptides/${stateSlug}` },
                  { label: city.name, href: null },
                ].map((crumb, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {i > 0 && <span style={{ color: 'var(--grey-600)', fontSize: '0.65rem' }}>&#8250;</span>}
                    {crumb.href ? (
                      <Link href={crumb.href} className="city-crumb" style={{ fontSize: '0.78rem', color: 'var(--grey-500)', transition: 'color 0.2s', textDecoration: 'none' }}>
                        {crumb.label}
                      </Link>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--silver)' }}>{crumb.label}</span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>

            {/* Status badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
              <span className="city-ruo-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(229,62,62,0.4)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#ff6b6b' }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 3h12"/><path d="M9 3v6l-5 9a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-5-9V3"/>
                </svg>
                Research Use Only
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 'var(--radius-full)', background: 'rgba(192,184,168,0.08)', border: '1px solid rgba(192,184,168,0.2)', fontSize: '0.68rem', fontWeight: 600, color: 'var(--silver)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {city.name}, {city.stateAbbr}
              </span>
              {city.tier === 1 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 'var(--radius-full)', background: 'rgba(255,196,0,0.08)', border: '1px solid rgba(255,196,0,0.25)', fontSize: '0.68rem', fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  Priority Market
                </span>
              )}
            </div>

            {/* H1 */}
            <h1 style={{ color: 'var(--white)', fontSize: 'clamp(2.4rem, 6vw, 4.5rem)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: 'var(--space-5)', maxWidth: 700, fontFamily: 'var(--font-brand)' }}>
              Peptide Research<br />
              in <span style={{ color: 'var(--teal)', textShadow: '0 0 40px rgba(0,196,188,0.5)' }}>{city.name}</span>
            </h1>

            {/* Subheading */}
            <p style={{ fontSize: 'clamp(1rem, 1.8vw, 1.15rem)', maxWidth: 560, color: 'var(--silver-light)', lineHeight: 1.7, marginBottom: 'var(--space-8)', opacity: 0.9 }}>
              {intro}
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-10)', alignItems: 'center' }}>
              <Link href="/research" className="city-img-btn" aria-label="Access the Lab">
                <img src="/images/buttons/btn-access.png" alt="Access the Lab" />
              </Link>
              <Link href="/research" className="city-img-btn" aria-label="Browse Catalog">
                <img src="/images/buttons/btn-browse.png" alt="Browse Catalog" />
              </Link>
            </div>

            {/* Stats strip — numbers CENTERED */}
            <div style={{ display: 'flex', gap: 'clamp(24px, 6vw, 72px)', paddingTop: 'var(--space-8)', borderTop: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' }}>
              {[
                { num: '100+', label: 'Research Compounds' },
                { num: '50',   label: 'States Served' },
                { num: '3',    label: 'Wholesale Tiers' },
                { num: '100%', label: 'Verified Access' },
              ].map(({ num, label }) => (
                <div key={label} className="city-stat-block">
                  <div className="city-stat-num">{num}</div>
                  <div className="city-stat-label">{label}</div>
                </div>
              ))}
            </div>

            {/* ── RUO DISCLAIMER — moved to BOTTOM of hero ── */}
            <div data-nosnippet style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'rgba(229,62,62,0.06)', border: '1px solid rgba(229,62,62,0.18)', borderRadius: 'var(--radius-lg)', padding: '11px 16px', maxWidth: 580, marginTop: 'var(--space-8)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <p style={{ fontSize: '0.73rem', color: 'var(--silver)', margin: 0, lineHeight: 1.6 }}>
                All products are <strong style={{ color: 'var(--red)' }}>strictly for in vitro research use only.</strong> Not for human or animal consumption. Verified researchers only.
              </p>
            </div>

          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            FEATURED PEPTIDES — dynamic BG + store cards + popular name
        ═══════════════════════════════════════════════════════════ */}
        <section style={{ position: 'relative', padding: 'clamp(64px, 8vw, 100px) 0', overflow: 'hidden' }}>
          {/* Dynamic molecule BG */}
          <Image src="/images/section-bg-catalog.jpg" alt="" fill unoptimized
            style={{ objectFit: 'cover', objectPosition: 'center', opacity: 0.18, pointerEvents: 'none' }} />
          {/* Dark overlay */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, var(--black) 0%, rgba(5,15,20,0.85) 40%, var(--black-2) 100%)', zIndex: 1 }} />

          <div className="container" style={{ position: 'relative', zIndex: 2 }}>
            {/* Section header */}
            <div style={{ marginBottom: 'clamp(40px, 5vw, 64px)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 14px', borderRadius: 'var(--radius-full)', background: 'var(--teal-subtle)', border: 'var(--border-teal)', fontSize: '0.68rem', fontWeight: 700, color: 'var(--teal)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-5)' }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 3h12"/><path d="M9 3v6l-5 9a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-5-9V3"/>
                </svg>
                Research Catalog
              </div>
              <h2 style={{ color: 'var(--white)', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 'var(--space-3)', maxWidth: 640 }}>
                Top 10 Research Compounds Near{' '}
                <span style={{ color: 'var(--teal)' }}>{city.name}</span>
              </h2>
              <p style={{ color: 'var(--grey-400)', fontSize: '0.95rem', maxWidth: 520, lineHeight: 1.65 }}>
                Our most in-demand compounds at wholesale pricing for verified researchers in {city.name}, {city.stateAbbr} and nationwide.
              </p>
            </div>

            {/* Products grid — 10 cards, store card design */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 'var(--space-5)' }}>
              {FEATURED_PEPTIDES.map((peptide) => (
                <Link key={peptide.slug} href={`/research/${peptide.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div className="city-pcard-wrapper">
                    <div className="city-pcard-inner">

                    {/* Badge */}
                    {peptide.badge && (
                      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(0,196,188,0.12)', border: '1px solid rgba(0,196,188,0.3)', fontSize: '0.6rem', fontWeight: 700, color: 'var(--teal)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {peptide.badge}
                      </div>
                    )}

                    {/* Image header (same as store card) */}
                    <div style={{ height: 140, background: 'radial-gradient(circle at 35% 35%, rgba(192,184,168,0.1) 0%, var(--surface-2) 80%)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      <Image
                        src={peptide.image}
                        alt={peptide.name}
                        width={120} height={120}
                        className="city-pcard-img"
                        unoptimized
                      />
                    </div>

                    {/* Card body */}
                    <div className="product-card-body" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      {/* Category */}
                      <div style={{ fontSize: '0.6rem', color: 'var(--grey-500)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
                        {peptide.category}
                      </div>

                      {/* Product name */}
                      <h3 style={{ color: 'var(--white)', fontSize: '1.05rem', fontWeight: 700, margin: '0 0 4px', lineHeight: 1.2 }}>
                        {peptide.name}
                      </h3>

                      {/* Popular name */}
                      <span className="popular-name-tag">
                        {peptide.popularName}
                      </span>

                      {/* Description */}
                      <p style={{ fontSize: '0.79rem', color: 'var(--grey-400)', lineHeight: 1.6, margin: '0 0 var(--space-4)', flex: 1 }}>
                        {peptide.description}
                      </p>

                      {/* View link */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--teal)', fontSize: '0.8rem', fontWeight: 700, paddingTop: 'var(--space-3)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        View Research
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* See full catalog CTA */}
            <div style={{ textAlign: 'center', marginTop: 'var(--space-12)' }}>
              <Link href="/research/a-z" className="city-img-btn" aria-label="Browse Full Research Catalog">
                <img src="/images/buttons/btn-browse-full.png" alt="Browse Full Research Catalog" />
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            WHY PEP NATION LAB — dynamic BG + Nano Banana 3D icons
        ═══════════════════════════════════════════════════════════ */}
        <section style={{ position: 'relative', padding: 'clamp(64px, 8vw, 100px) 0', overflow: 'hidden' }}>
          {/* Dynamic neural/hex BG */}
          <Image src="/images/section-bg-trust.jpg" alt="" fill unoptimized
            style={{ objectFit: 'cover', objectPosition: 'center', opacity: 0.22, pointerEvents: 'none' }} />
          {/* Overlay */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, var(--black) 0%, rgba(5,15,20,0.8) 50%, var(--black) 100%)', zIndex: 1 }} />

          <div className="container" style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ textAlign: 'center', marginBottom: 'clamp(40px, 5vw, 64px)' }}>
              <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 'var(--radius-full)', background: 'rgba(192,184,168,0.06)', border: '1px solid rgba(192,184,168,0.15)', fontSize: '0.68rem', fontWeight: 700, color: 'var(--grey-300)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-5)' }}>
                Why Researchers Choose Us
              </div>
              <h2 style={{ color: 'var(--white)', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 'var(--space-3)' }}>
                The {region}&apos;s Trusted Source for{' '}
                <span style={{ color: 'var(--teal)' }}>Research Peptides</span>
              </h2>
              <p style={{ color: 'var(--grey-400)', fontSize: '0.95rem', maxWidth: 480, margin: '0 auto', lineHeight: 1.65 }}>
                Researchers in {city.name} choose Pep Nation Lab for quality that scales with their lab.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 'var(--space-5)' }}>
              {VALUE_PROPS.map((vp) => (
                <div key={vp.title} className="city-vcard glass-panel" style={{ display: 'flex', gap: 'var(--space-4)', border: 'var(--border-subtle)' }}>
                  {/* Nano Banana 3D icon */}
                  <div style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden', position: 'relative' }}>
                    <Image
                      src={VALUE_ICON_IMAGE[vp.icon] ?? '/images/icons/icon-compounds.jpg'}
                      alt={vp.title}
                      fill
                      unoptimized
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ color: 'var(--silver-light)', fontSize: '0.95rem', marginBottom: 'var(--space-2)', fontWeight: 700 }}>
                      {vp.title}
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--grey-400)', lineHeight: 1.65, margin: 0 }}>
                      {vp.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            AGENT NETWORK CTA
        ═══════════════════════════════════════════════════════════ */}
        <section style={{ position: 'relative', borderTop: 'var(--border-subtle)', borderBottom: 'var(--border-subtle)', padding: 'clamp(48px, 6vw, 80px) 0', overflow: 'hidden' }}>
          {/* Reuse the catalog BG at a different opacity */}
          <Image src="/images/section-bg-catalog.jpg" alt="" fill unoptimized
            style={{ objectFit: 'cover', objectPosition: 'center bottom', opacity: 0.12, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'var(--black-2)', opacity: 0.75, zIndex: 1 }} />

          <div className="container" style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(0,196,188,0.06) 0%, rgba(0,0,0,0) 60%)', border: 'var(--border-teal)', borderRadius: 'var(--radius-2xl)', padding: 'clamp(28px, 4vw, 52px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-8)' }}>
              <div style={{ maxWidth: 520 }}>
                <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 'var(--radius-full)', background: 'var(--teal-subtle)', border: 'var(--border-teal)', fontSize: '0.65rem', fontWeight: 700, color: 'var(--teal)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-4)' }}>
                  {region} Agent Network
                </div>
                <h2 style={{ color: 'var(--white)', fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 'var(--space-4)' }}>
                  Serve Researchers In<br />
                  <span style={{ color: '#d4cdbb' }}>{city.name}</span>
                </h2>
                <p style={{ color: 'var(--grey-400)', lineHeight: 1.7, margin: 0, fontSize: '0.9rem' }}>
                  Join the Pep Nation Lab agent network and build your business in the {region} area. Earn recurring commissions by connecting qualified researchers with premium compounds at wholesale pricing.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <Link href="/become-agent" className="city-img-btn" aria-label="Become an Agent">
                  <img src="/images/buttons/btn-agent.png" alt="Become an Agent" />
                </Link>
                <Link href="/login" style={{ fontSize: '0.8rem', color: 'var(--grey-500)', textDecoration: 'underline', textUnderlineOffset: 3, textAlign: 'center' }}>
                  Already an agent? Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            FAQ — dynamic hero BG reused at low opacity
        ═══════════════════════════════════════════════════════════ */}
        <section style={{ position: 'relative', padding: 'clamp(64px, 8vw, 100px) 0', overflow: 'hidden' }}>
          <Image src="/images/city-hero-peptide.jpg" alt="" fill unoptimized
            style={{ objectFit: 'cover', objectPosition: 'right center', opacity: 0.06, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, var(--black) 0%, rgba(5,10,15,0.9) 50%, var(--black) 100%)', zIndex: 1 }} />

          <div className="container" style={{ position: 'relative', zIndex: 2, maxWidth: 780, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 'clamp(40px, 5vw, 56px)' }}>
              <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 'var(--radius-full)', background: 'rgba(192,184,168,0.06)', border: '1px solid rgba(192,184,168,0.15)', fontSize: '0.68rem', fontWeight: 700, color: 'var(--grey-300)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-5)' }}>
                Common Questions
              </div>
              <h2 style={{ color: 'var(--white)', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 'var(--space-3)' }}>
                Peptide Research in{' '}
                <span style={{ color: 'var(--teal)' }}>{city.name}, {city.stateAbbr}</span>
              </h2>
              <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem' }}>
                Common questions from researchers in {city.name} and the {region} area.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {faqs.map((faq, i) => (
                <details key={i} className="glass-panel" style={{ overflow: 'hidden' }}>
                  <summary style={{ padding: 'var(--space-5) var(--space-6)', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', color: 'var(--silver-light)', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <span>{faq.question}</span>
                    <svg className="city-faq-chevron" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" style={{ flexShrink: 0, transition: 'transform 0.25s' }}>
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </summary>
                  <div style={{ padding: '0 var(--space-6) var(--space-5)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <p style={{ fontSize: '0.87rem', color: 'var(--grey-400)', lineHeight: 1.78, margin: 0, paddingTop: 'var(--space-4)' }}>
                      {faq.answer}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            FINAL CTA
        ═══════════════════════════════════════════════════════════ */}
        <section style={{ position: 'relative', borderTop: 'var(--border-subtle)', padding: 'clamp(64px, 8vw, 100px) 0', textAlign: 'center', overflow: 'hidden' }}>
          <Image src="/images/section-bg-trust.jpg" alt="" fill unoptimized
            style={{ objectFit: 'cover', objectPosition: 'center', opacity: 0.15, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'var(--black-2)', opacity: 0.8, zIndex: 1 }} />

          <div className="container" style={{ position: 'relative', zIndex: 2, maxWidth: 620 }}>

            <h2 style={{ color: 'var(--white)', fontSize: 'clamp(2.4rem, 6vw, 3.8rem)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 'var(--space-4)' }}>
              Ready To Start Your Research{' '}
              <span style={{ color: '#d4cdbb' }}>In {city.name}?</span>
            </h2>
            <p style={{ color: 'var(--grey-400)', lineHeight: 1.7, marginBottom: 'var(--space-8)', fontSize: '0.95rem' }}>
              Create a verified researcher account today and unlock wholesale pricing on 100+ pharmaceutical-grade peptides shipped fast to {city.name}, {city.stateAbbr}.
            </p>

            <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
              <Link href="/research" className="city-img-btn" aria-label="Access the Lab">
                <img src="/images/buttons/btn-access.png" alt="Access the Lab" />
              </Link>
              <Link href="/research" className="city-img-btn" aria-label="Explore Research Library">
                <img src="/images/buttons/btn-explore.png" alt="Explore Research Library" />
              </Link>
            </div>

            <div style={{ marginTop: 'var(--space-8)', display: 'flex', justifyContent: 'center' }}>
              <Image src="/images/badges/research_use_pill_transparent.png" alt="Research Use Only" width={300} height={56} unoptimized style={{ height: 'auto', maxWidth: 300, opacity: 0.5 }} />
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            NEARBY CITIES STRIP
        ═══════════════════════════════════════════════════════════ */}
        <NearbyStrip stateSlug={stateSlug} currentCitySlug={citySlug} stateName={city.state} />

        {/* ═══════════════════════════════════════════════════════════
            FOOTER
        ═══════════════════════════════════════════════════════════ */}
        <footer style={{ background: 'var(--black)', borderTop: '1px solid rgba(192,184,168,0.06)', padding: 'var(--space-8) 0' }}>
          <div className="container">
            <div data-nosnippet style={{ background: 'rgba(229,62,62,0.04)', border: '1px solid rgba(229,62,62,0.12)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
              <p style={{ fontSize: '0.71rem', color: 'var(--grey-500)', lineHeight: 1.7, textAlign: 'center', margin: 0 }}>
                <strong style={{ color: 'rgba(229,62,62,0.8)' }}>Research Use Only Disclaimer:</strong>{' '}
                All products sold on PepNationLab.com are strictly for in vitro laboratory research and analytical purposes only.
                They are NOT intended for human or animal consumption, ingestion, or injection.
                These products have not been evaluated or approved by the FDA.
                Purchasers assume full legal responsibility for compliance with all applicable laws.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
                {[
                  { label: 'Home', href: '/' },
                  { label: 'Research Library', href: '/research' },
                  { label: 'Peptides By City', href: '/peptides' },
                  { label: 'Disclaimer', href: '/disclaimer' },
                  { label: 'Terms', href: '/terms' },
                  { label: 'Privacy', href: '/privacy' },
                ].map(({ label, href }) => (
                  <Link key={label} href={href} className="city-flink" style={{ fontSize: '0.76rem', color: 'var(--grey-600)', textDecoration: 'none', transition: 'color 0.2s' }}>
                    {label}
                  </Link>
                ))}
              </div>
              <p style={{ fontSize: '0.73rem', color: 'var(--grey-600)', margin: 0 }}>
                &copy; {new Date().getFullYear()} Pep Nation Lab LLC. All Rights Reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

// ─── Nearby cities strip ──────────────────────────────────────────────────
function NearbyStrip({ stateSlug, currentCitySlug, stateName }: {
  stateSlug: string; currentCitySlug: string; stateName: string;
}) {
  const nearby = CITIES
    .filter((c) => c.stateSlug === stateSlug && c.slug !== currentCitySlug)
    .sort((a, b) => b.population - a.population)
    .slice(0, 10);

  if (nearby.length === 0) return null;

  return (
    <section style={{ padding: 'var(--space-10) 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="container">
        <p style={{ fontSize: '0.7rem', color: 'var(--grey-600)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-4)' }}>
          More cities in {stateName}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {nearby.map((c) => (
            <Link key={c.slug} href={`/peptides/${stateSlug}/${c.slug}`} className="city-pill" style={{ padding: '5px 14px', fontSize: '0.78rem', color: 'var(--grey-500)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 'var(--radius-full)', textDecoration: 'none', transition: 'all 0.2s' }}>
              {c.name}
            </Link>
          ))}
          <Link href={`/peptides/${stateSlug}`} style={{ padding: '5px 14px', fontSize: '0.78rem', color: 'var(--teal)', background: 'var(--teal-subtle)', border: 'var(--border-teal)', borderRadius: 'var(--radius-full)', textDecoration: 'none', fontWeight: 600 }}>
            All {stateName} Cities
          </Link>
        </div>
      </div>
    </section>
  );
}
