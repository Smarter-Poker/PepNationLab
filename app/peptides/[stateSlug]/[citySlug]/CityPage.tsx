

/**
 * CityPage.tsx
 * Premium city landing page:
 * - RUO disclaimer moved to BOTTOM of hero (after stats)
 * - Stats numbers centered over labels
 * - Dynamic section backgrounds on every section
 * - Top 10 grid mirrors the LIVE storefront Top 10 (names, sizes, prices)
 * - Nano Banana 3D icons for value props
 */

import Link from 'next/link';
import Image from 'next/image';
import { CITIES } from '@/lib/cities/cities-data';
import type { City } from '@/lib/cities/cities-data';
import { CITY_COMPOUNDS } from '@/lib/cities/city-compounds';
import { FEATURED_PEPTIDES } from '@/lib/cities/keywords';
import { getCityIntro, getCityFAQs, getCityFacts, VALUE_PROPS, getRegionLabel, getRegionArea } from '@/lib/cities/city-content';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';
import type { StoreTop10Item } from '@/lib/cities/top10-server';
import { getNearMeCities } from '@/lib/cities/near-me';

interface Props {
  city: City;
  stateSlug: string;
  citySlug: string;
  /** Live storefront Top 10 (same products, names, and prices as /researchstore). */
  top10?: StoreTop10Item[];
}

/** Unified card shape: live store data when available, static fallback otherwise. */
interface TopCard {
  key: string;
  href: string;
  name: string;
  subtitle: string | null;
  image: string;
  sizeLabel: string;
  price: number;
  originalPrice: number | null;
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

export default function CityPage({ city, stateSlug, citySlug, top10 }: Props) {
  const intro = getCityIntro(city);
  const faqs = getCityFAQs(city);
  const region = getRegionLabel(city);
  const facts = getCityFacts(city);

  // The Top 10 grid mirrors the storefront's "Top 10 Best Peptides" card:
  // identical products, names, sizes, and live prices. Cards deep-link into
  // the store (?product=) so shoppers land on the exact same item. Static
  // FEATURED_PEPTIDES only renders if the live fetch returned nothing.
  const topCards: TopCard[] =
    top10 && top10.length > 0
      ? top10.map((p) => ({
          key: p.productId,
          href: `/${DEFAULT_STORE_SLUG}?product=${p.productId}`,
          name: p.name,
          subtitle: p.subtitle,
          image: p.image,
          sizeLabel: p.sizeLabel,
          price: p.price,
          originalPrice: p.originalPrice,
        }))
      : FEATURED_PEPTIDES.map((p) => ({
          key: p.slug,
          href: `/research/${p.slug}`,
          name: p.name,
          subtitle: p.popularName ?? null,
          image: p.image,
          sizeLabel: p.size ?? '10mg Vials',
          price: p.price ?? 0,
          originalPrice: null,
        }));

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
          object-fit: cover;
        }
        .city-flink:hover { color: var(--teal) !important; }
        .city-vcard { transition: all 0.2s; }
        .city-vcard:hover {
          border-color: rgba(192,184,168,0.25) !important;
          transform: translateY(-2px);
        }
        details[open] .city-faq-chevron { transform: rotate(180deg); }
        details summary::-webkit-details-marker { display: none; }

        /* stat numbers - centered */
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

        /* Hero entrance - transform-only ON PURPOSE. Animating opacity from 0
           on the hero container hides the H1 (the LCP element) for the
           animation duration: real-user LCP is delayed and Lighthouse drops
           the candidate entirely ("LCP candidate missing" -> broken simulated
           LCP). The slide-up keeps the motion while content paints, fully
           visible, from the first frame. Do not re-add opacity here. */
        @keyframes city-fadein {
          from { transform: translateY(24px); }
          to   { transform: translateY(0); }
        }
        .city-fadein { animation: city-fadein 0.75s ease forwards; }

        /* PNG image buttons — transparent bg, full clickable area */
        .city-btn-img {
          display: block;
          height: 84px;
          width: auto;
          cursor: pointer;
          transition: transform 0.18s ease, filter 0.18s ease;
          -webkit-user-drag: none;
          user-select: none;
        }
        .city-btn-img:hover {
          transform: translateY(-2px) scale(1.03);
          filter: brightness(1.08);
        }
        .city-btn-img:active {
          transform: translateY(0) scale(0.98);
          filter: brightness(0.95);
        }
        a.city-btn-link {
          display: inline-block;
          line-height: 0;
          text-decoration: none;
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
        {/* NOTE: JSON-LD (BreadcrumbList, FAQPage, Service, WebPage, ItemList)
            is emitted ONCE, server-side, in page.tsx. Do not add another
            ld+json block here - duplicate Service/Breadcrumb nodes on the same
            URL are conflicting structured data and hurt rich-result parsing. */}

        {/* ═════════════════════════════════════════
            HERO - 3D peptide helix full-bleed
        ═════════════════════════════════════════ */}
        <section style={{ position: 'relative', minHeight: 'clamp(640px, 95vh, 980px)', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          {/* BG image */}
          <Image src="/images/city-hero-peptide.jpg" alt={`Research Peptides In ${city.name}, ${city.state}${city.county ? ` - ${city.county} County` : ''} - Research-Grade Peptide Supply For Verified Researchers`} fill priority
            fetchPriority="high"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1400px" quality={45}
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
              Research Peptides<br />
              In <span style={{ color: 'var(--teal)', textShadow: '0 0 40px rgba(0,196,188,0.5)' }}>{city.name}</span>
            </h1>

            {/* Subheading */}
            <p style={{ fontSize: 'clamp(1rem, 1.8vw, 1.15rem)', maxWidth: 560, color: 'var(--silver-light)', lineHeight: 1.7, marginBottom: 'var(--space-5)', opacity: 0.9 }}>
              {intro}
            </p>

            {/* Local Blurb */}
            {city.localBlurb && (
              <p style={{ fontSize: '0.95rem', maxWidth: 560, color: 'var(--teal)', lineHeight: 1.6, marginBottom: 'var(--space-6)', fontStyle: 'italic', opacity: 0.9 }}>
                {city.localBlurb}
              </p>
            )}




            {/* CTAs — custom PNG buttons */}
            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-10)', alignItems: 'center' }}>
              <Link href="/research" className="btn btn-neon-cyan btn-lg">
                Access The Lab
              </Link>
              <Link href={`/${DEFAULT_STORE_SLUG}`} className="btn btn-secondary btn-lg">
                Browse Catalog
              </Link>
            </div>

            {/* Stats strip - numbers CENTERED */}
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

            {/* ── RUO DISCLAIMER - moved to BOTTOM of hero ── */}
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

        {/* ═════════════════════════════════════════
            FEATURED PEPTIDES - LIVE storefront Top 10 (same names + prices)
        ═════════════════════════════════════════ */}
        <section style={{ position: 'relative', padding: 'clamp(64px, 8vw, 100px) 0', overflow: 'hidden' }}>
          {/* Nano Banana background */}
          <Image src="/images/city-sections/bg-catalog.jpg" alt="" fill aria-hidden
            sizes="100vw" quality={40} style={{ objectFit: 'cover', objectPosition: 'center', opacity: 0.35 }} />
          {/* Dark overlay */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, var(--black) 0%, rgba(5,15,20,0.55) 40%, var(--black) 100%)', zIndex: 1 }} />

          <div className="container" style={{ position: 'relative', zIndex: 2 }}>
            {/* Section header */}
            <div style={{ marginBottom: 'clamp(40px, 5vw, 64px)' }}>
              <h3 style={{ color: 'var(--teal)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
                Research Catalog
              </h3>
              <h2 style={{ color: 'var(--white)', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 'var(--space-3)', maxWidth: 640 }}>
                Top 10 Research Compounds Near{' '}
                <span style={{ color: 'var(--teal)' }}>{city.name}</span>
              </h2>
              <p style={{ color: 'var(--grey-400)', fontSize: '0.95rem', maxWidth: 520, lineHeight: 1.65 }}>
                Our most in-demand compounds at wholesale pricing for verified researchers in {city.name}, {city.stateAbbr} and nationwide.
              </p>
            </div>

            {/* Products grid - 10 cards, store card design */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 'var(--space-5)' }}>
              {topCards.map((card) => (
                <Link key={card.key} href={card.href} style={{ textDecoration: 'none', display: 'block' }}>
                  <div className="city-pcard-wrapper">
                    <div className="city-pcard-inner">

                    {/* Image header - full-bleed, edge to edge like the store card */}
                    <div style={{ position: 'relative', height: 180, overflow: 'hidden', background: 'var(--surface-2)' }}>
                      <Image
                        src={card.image}
                        alt={`${card.name}${card.subtitle ? ` (${card.subtitle})` : ''} Research Peptide ${card.sizeLabel} - Available To Researchers In ${city.name}, ${city.stateAbbr}`}
                        fill
                        sizes="(max-width: 768px) 50vw, 280px"
                        className="city-pcard-img"
                        unoptimized={card.image.startsWith('http')}
                      />
                    </div>

                    {/* Card body */}
                    <div style={{ padding: 'var(--space-5)', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
                        <h4 style={{
                          fontFamily: 'var(--font-brand)',
                          fontSize: '1.15rem', color: 'var(--white)', letterSpacing: '0.02em', lineHeight: 1.2,
                          marginBottom: card.subtitle ? 2 : 0
                        }}>
                          {card.name}
                        </h4>
                        {card.subtitle && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)', fontWeight: 500 }}>
                            ({card.subtitle})
                          </span>
                        )}
                      </div>

                      <div style={{
                        marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 'var(--space-4)',
                        textAlign: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          {card.originalPrice !== null && (
                            <span style={{ fontSize: '0.95rem', color: 'var(--grey-500)', textDecoration: 'line-through', fontWeight: 600 }}>
                              ${card.originalPrice.toFixed(2)}
                            </span>
                          )}
                          <span className="sf-product-price-nickel" style={{
                            fontSize: '1.2rem', fontWeight: 800,
                            fontFamily: 'var(--font-brand)',
                            color: 'var(--white)',
                          }}>
                            {card.sizeLabel} &nbsp;${card.price.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* See full catalog CTA */}
            <div style={{ textAlign: 'center', marginTop: 'var(--space-12)' }}>
              <Link href={`/${DEFAULT_STORE_SLUG}`} className="btn btn-primary btn-xl">
                Browse Full Research Catalog
              </Link>
            </div>
          </div>
        </section>

        {/* ═════════════════════════════════════════
            AT A GLANCE - dense, quotable fact box (answer-engine bait:
            AI assistants and featured snippets quote exactly this kind
            of self-contained factual block)
        ═════════════════════════════════════════ */}
        {/* Visually hidden (clip-rect) but fully present in the HTML and
            accessibility tree. This dense fact block is answer-engine bait -
            AI assistants and featured snippets quote exactly this kind of
            self-contained factual content - but it read as a generic text
            glob on the visible page. Do not remove; hide-only. */}
        <section aria-label={`${city.name} Research Supply Facts`} style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
          {/* Nano Banana background */}
          <Image src="/images/city-sections/bg-facts.jpg" alt="" fill aria-hidden
            sizes="100vw" quality={40} style={{ objectFit: 'cover', objectPosition: 'center top', opacity: 0.22 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, var(--black) 0%, rgba(5,10,18,0.7) 50%, var(--black) 100%)', zIndex: 1 }} />
          <div className="container" style={{ position: 'relative', zIndex: 2 }}>
            <h2 style={{ color: 'var(--white)', fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 'var(--space-4)' }}>
              Research Peptide Supply In {city.name} - At A Glance
            </h2>
            {/* Intro is fact-oriented and does NOT repeat city.localBlurb
                (which already renders as a standalone paragraph under the H1)
                to avoid duplicate copy on the same page. */}
            <p style={{ fontSize: '0.92rem', color: 'var(--silver-light)', lineHeight: 1.75, maxWidth: 780, marginBottom: 'var(--space-5)' }}>
              Key facts for verified researchers sourcing research-grade peptides in {city.name}, {city.stateAbbr}. Every order ships nationwide with full batch COA documentation, strictly for in vitro laboratory use.
            </p>
            <dl style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 'var(--space-3)',
              margin: 0,
            }}>
              {facts.map(({ label, value }) => (
                <div key={label} className="glass-panel" style={{ padding: 'var(--space-4) var(--space-5)', border: 'var(--border-subtle)' }}>
                  <dt style={{ fontSize: '0.65rem', color: 'var(--grey-500)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    {label}
                  </dt>
                  <dd style={{ fontSize: '0.85rem', color: 'var(--silver-light)', margin: 0, lineHeight: 1.55 }}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ═════════════════════════════════════════
            WHY PEP NATION LAB - dynamic BG + Nano Banana 3D icons
        ═════════════════════════════════════════ */}
        <section style={{ position: 'relative', padding: 'clamp(64px, 8vw, 100px) 0', overflow: 'hidden' }}>
          {/* Nano Banana background */}
          <Image src="/images/city-sections/bg-why.jpg" alt="" fill aria-hidden
            sizes="100vw" quality={40} style={{ objectFit: 'cover', objectPosition: 'center', opacity: 0.3 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, var(--black) 0%, rgba(4,8,16,0.55) 50%, var(--black) 100%)', zIndex: 1 }} />

          <div className="container" style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ textAlign: 'center', marginBottom: 'clamp(40px, 5vw, 64px)' }}>
              <h3 style={{ color: 'var(--grey-300)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
                Why Researchers Choose Us
              </h3>
              <h2 style={{ color: 'var(--white)', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 'var(--space-3)' }}>
                The {region}&apos;s Trusted Source For{' '}
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
                      sizes="64px"
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

        {/* ═════════════════════════════════════════
            AGENT NETWORK CTA
        ═════════════════════════════════════════ */}
        <section style={{ position: 'relative', borderTop: 'var(--border-subtle)', borderBottom: 'var(--border-subtle)', padding: 'clamp(48px, 6vw, 80px) 0', overflow: 'hidden' }}>
          {/* Nano Banana background */}
          <Image src="/images/city-sections/bg-agent.jpg" alt="" fill aria-hidden
            sizes="100vw" quality={40} style={{ objectFit: 'cover', objectPosition: 'center', opacity: 0.45 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, var(--black) 0%, rgba(3,8,12,0.5) 50%, var(--black) 100%)', zIndex: 1 }} />

          <div className="container" style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(0,196,188,0.06) 0%, rgba(0,0,0,0) 60%)', border: 'var(--border-teal)', borderRadius: 'var(--radius-2xl)', padding: 'clamp(28px, 4vw, 52px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-8)' }}>
              <div style={{ maxWidth: 520 }}>
                <h3 style={{ color: 'var(--teal)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
                  {region} Agent Network
                </h3>
                <h2 style={{ color: 'var(--white)', fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 'var(--space-4)' }}>
                  Serve Researchers In<br />
                  <span style={{ color: '#d4cdbb' }}>{city.name}</span>
                </h2>
                <p style={{ color: 'var(--grey-400)', lineHeight: 1.7, margin: 0, fontSize: '0.9rem' }}>
                  Join the Pep Nation Lab agent network and build your business in the {getRegionArea(region)}. Earn recurring commissions by connecting qualified researchers with premium compounds at wholesale pricing.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'center' }}>
                <Link href="/become-agent" className="btn btn-neon-cyan btn-lg">
                  Become An Agent
                </Link>
                <Link href="/login" style={{ fontSize: '0.8rem', color: 'var(--grey-500)', textDecoration: 'underline', textUnderlineOffset: 3, textAlign: 'center' }}>
                  Already An Agent? Sign In
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ═════════════════════════════════════════
            FAQ - dynamic hero BG reused at low opacity
        ═════════════════════════════════════════ */}
        <section style={{ position: 'relative', padding: 'clamp(64px, 8vw, 100px) 0', overflow: 'hidden' }}>
          {/* Nano Banana background */}
          <Image src="/images/city-sections/bg-faq.jpg" alt="" fill aria-hidden
            sizes="100vw" quality={40} style={{ objectFit: 'cover', objectPosition: 'center', opacity: 0.28 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, var(--black) 0%, rgba(3,6,8,0.55) 50%, var(--black) 100%)', zIndex: 1 }} />

          <div className="container" style={{ position: 'relative', zIndex: 2, maxWidth: 780, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 'clamp(40px, 5vw, 56px)' }}>
              <h3 style={{ color: 'var(--grey-300)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
                Common Questions
              </h3>
              <h2 style={{ color: 'var(--white)', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 'var(--space-3)' }}>
                Peptide Research In{' '}
                <span style={{ color: 'var(--teal)' }}>{city.name}, {city.stateAbbr}</span>
              </h2>
              <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem' }}>
                Common questions from researchers in {city.name} and the {getRegionArea(region)}.
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

        {/* ═════════════════════════════════════════
            FINAL CTA
        ═════════════════════════════════════════ */}
        <section style={{ position: 'relative', borderTop: 'var(--border-subtle)', padding: 'clamp(64px, 8vw, 100px) 0', textAlign: 'center', overflow: 'hidden' }}>
          {/* Nano Banana background */}
          <Image src="/images/city-sections/bg-cta.jpg" alt="" fill aria-hidden
            sizes="100vw" quality={40} style={{ objectFit: 'cover', objectPosition: 'center', opacity: 0.5 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, var(--black) 0%, rgba(2,5,8,0.4) 50%, var(--black) 100%)', zIndex: 1 }} />

          <div className="container" style={{ position: 'relative', zIndex: 2, maxWidth: 620 }}>

            <h2 style={{ color: 'var(--white)', fontSize: 'clamp(2.4rem, 6vw, 3.8rem)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 'var(--space-4)' }}>
              Ready To Start Your Research{' '}
              <span style={{ color: '#d4cdbb' }}>In {city.name}?</span>
            </h2>
            <p style={{ color: 'var(--grey-400)', lineHeight: 1.7, marginBottom: 'var(--space-8)', fontSize: '0.95rem' }}>
              Create a verified researcher account today and unlock wholesale pricing on 100+ research-grade peptides shipped fast to {city.name}, {city.stateAbbr}.
            </p>

            <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
              <Link href="/research" className="btn btn-neon-cyan btn-lg">
                Access The Lab
              </Link>
              <Link href={`/${DEFAULT_STORE_SLUG}`} className="btn btn-primary btn-lg">
                Browse Full Catalog
              </Link>
            </div>

            <div style={{ marginTop: 'var(--space-8)', display: 'flex', justifyContent: 'center' }}>
              <Image src="/images/badges/research_use_pill_transparent.png" alt="Research Use Only" width={300} height={56} style={{ height: 'auto', maxWidth: 300, opacity: 0.5 }} />
            </div>
          </div>
        </section>

        {/* ═════════════════════════════════════════
            NEARBY CITIES STRIP
        ═════════════════════════════════════════ */}
        {/* POPULAR RESEARCH COMPOUNDS IN THIS CITY - crawlable pill links to compound-city pages */}
        <section style={{ padding: 'var(--space-10) 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div className='container'>
            <p style={{ fontSize: '0.7rem', color: 'var(--grey-600)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-4)' }}>
              Popular Research Compounds In {city.name}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {CITY_COMPOUNDS.map((cc) => (
                <Link key={cc.slug} href={`/peptides/${stateSlug}/${citySlug}/${cc.slug}`} className='city-pill' style={{ padding: '5px 14px', fontSize: '0.78rem', color: 'var(--grey-500)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 'var(--radius-full)', textDecoration: 'none', transition: 'all 0.2s' }}>
                  {cc.displayName} In {city.name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* PEPTIDES NEAR ME - visible, crawlable geographic coverage block
            targeting "peptides near me {city}" queries. Adds content only. */}
        <NearMeSection city={city} stateSlug={stateSlug} region={region} />

        <NearbyStrip stateSlug={stateSlug} currentCitySlug={citySlug} stateName={city.state} region={city.region} />

        {/* ═════════════════════════════════════════
            FOOTER
        ═════════════════════════════════════════ */}
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

// ─── Nearby cities strip ──────────────────────────────────────────────────────────────────────────────────────────────
// Links same-state cities PLUS same-region cities across state lines (metro
// areas like Kansas City or the NYC tri-state span states), strengthening the
// internal link mesh between related pages.
function NearbyStrip({ stateSlug, currentCitySlug, stateName, region }: {
  stateSlug: string; currentCitySlug: string; stateName: string; region?: string;
}) {
  // Same-region cities first (geographic silo), then by population.
  const sameState = CITIES
    .filter((c) => c.stateSlug === stateSlug && c.slug !== currentCitySlug)
    .sort((a, b) => {
      const aSame = region && a.region === region ? 1 : 0;
      const bSame = region && b.region === region ? 1 : 0;
      if (aSame !== bSame) return bSame - aSame;
      return b.population - a.population;
    });
  const crossState = region
    ? CITIES.filter((c) => c.stateSlug !== stateSlug && c.region === region)
        .sort((a, b) => b.population - a.population)
        .slice(0, 3)
    : [];
  const nearby = [...sameState.slice(0, 10 - crossState.length), ...crossState];

  if (nearby.length === 0) return null;

  return (
    <section style={{ padding: 'var(--space-10) 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="container">
        <p style={{ fontSize: '0.7rem', color: 'var(--grey-600)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-4)' }}>
          More Cities In {stateName}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {nearby.map((c) => (
            /* Use each city's OWN stateSlug - cross-state metro cities must
               link into their own state path. */
            <Link key={`${c.stateSlug}-${c.slug}`} href={`/peptides/${c.stateSlug}/${c.slug}`} className="city-pill" style={{ padding: '5px 14px', fontSize: '0.78rem', color: 'var(--grey-500)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 'var(--radius-full)', textDecoration: 'none', transition: 'all 0.2s' }}>
              {c.stateSlug === stateSlug ? c.name : `${c.name}, ${c.stateAbbr}`}
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

// --- Peptides Near Me section ------------------------------------------------
// Visible, crawlable geographic coverage block rendered before the
// NearbyStrip. Targets "peptides near me {city}" queries with genuine
// nearby-city data (same region first, then same state - see
// lib/cities/near-me.ts). Adds content only; never remove existing sections
// (the daily city-pages verifier asserts them).
function NearMeSection({ city, stateSlug, region }: { city: City; stateSlug: string; region: string }) {
  const nearby = getNearMeCities(city);
  if (nearby.length === 0) return null;
  const area = getRegionArea(region);
  const topThree = nearby.slice(0, 3).map((c) => c.name);
  const topThreeLabel =
    topThree.length >= 3
      ? `${topThree[0]}, ${topThree[1]}, And ${topThree[2]}`
      : topThree.join(' And ');
  return (
    <section aria-label={`Peptides Near Me - ${city.name} Area`} style={{ padding: 'clamp(48px, 6vw, 80px) 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="container">
        <h3 style={{ color: 'var(--teal)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
          Local Research Coverage
        </h3>
        <h2 style={{ color: 'var(--white)', fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 'var(--space-3)' }}>
          Peptides Near Me - <span style={{ color: 'var(--teal)' }}>{city.name} Area</span>
        </h2>
        <p style={{ color: 'var(--grey-400)', fontSize: '0.92rem', maxWidth: 720, lineHeight: 1.7, marginBottom: 'var(--space-6)' }}>
          Researchers Searching For Peptides Near Me In The {area} Find Local Coverage Across {nearby.length} Nearby {nearby.length === 1 ? 'City' : 'Cities'} Including {topThreeLabel}. Every Covered City Below Links To Its Own Dedicated Research Supply Page, And All Orders Ship With Full Batch COA Documentation, Strictly For In Vitro Research Use Only.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 'var(--space-3)' }}>
          {nearby.map((c) => (
            <Link key={`${c.stateSlug}-${c.slug}`} href={`/peptides/${c.stateSlug}/${c.slug}`} className="city-vcard glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 'var(--space-4) var(--space-5)', border: 'var(--border-subtle)', textDecoration: 'none' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--silver-light)' }}>
                {c.stateSlug === stateSlug ? c.name : `${c.name}, ${c.stateAbbr}`}
              </span>
              {c.county && (
                <span style={{ fontSize: '0.72rem', color: 'var(--grey-500)' }}>
                  {c.county} County
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
