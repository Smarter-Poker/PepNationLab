import type { Metadata } from 'next';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import {
  ArrowDown,
  ShieldCheck,
  FlaskConical,
  Users,
  CircleDollarSign,
  Shield,
  Microscope,
  TestTubes,
  ClipboardCheck,
  Lock,
  Package,
  UserRound,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'About | Pep Nation Lab',
  description:
    'Pep Nation Lab Is A Research-First Peptide Distribution Platform Built To Support Qualified Researchers With Access To High-Quality Compounds, Transparent Pricing, And Unmatched Service.',
};

// What We Do -- Four Pillars (Copy Matches The Approved Design Artwork)
const PILLARS = [
  {
    title: 'Wholesale Distribution',
    body: 'We Connect Qualified Researchers And Institutions With Research Compounds At Transparent Wholesale Pricing, Removing The Markup Layers Of Traditional Supply Chains.',
    icon: <Package size={30} strokeWidth={1.5} />,
  },
  {
    title: 'Research-Grade Compounds',
    body: 'Every Compound In Our Catalog Is Intended Strictly For In Vitro Laboratory Research And Analytical Science. We Do Not Sell Consumer Health Products.',
    icon: <FlaskConical size={30} strokeWidth={1.5} />,
  },
  {
    title: 'Agent Network',
    body: 'Qualified High-Volume Researchers Can Operate Their Own Branded Storefronts As Agents, Building Research-Supply Businesses On Top Of Our Distribution Platform.',
    icon: <Users size={30} strokeWidth={1.5} />,
  },
  {
    title: 'Transparent Pricing',
    body: 'Tier-Based Pricing Multipliers Are Configurable And Consistent. Researchers And Agents Always See Exactly How A Price Is Derived From Base Cost.',
    icon: <CircleDollarSign size={30} strokeWidth={1.5} />,
  },
];

// Research-Only Commitment -- Five Compliance Pillars
const COMMITMENTS = [
  { label: 'Research Use Only', icon: <Shield size={26} strokeWidth={1.5} /> },
  { label: 'Not For Human Use', icon: <Microscope size={26} strokeWidth={1.5} /> },
  { label: 'Laboratory Research Only', icon: <TestTubes size={26} strokeWidth={1.5} /> },
  { label: 'Quality Assured', icon: <ClipboardCheck size={26} strokeWidth={1.5} /> },
  { label: 'Compliance Focused', icon: <Lock size={26} strokeWidth={1.5} /> },
];

export default function AboutPage() {
  return (
    <PageShell>
      {/* ============ Hero ============ */}
      <section className="section" style={{ paddingBottom: 'var(--space-8)', overflow: 'hidden' }}>
        <div
          className="container about-hero-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 0.9fr',
            gap: 'var(--space-8)',
            alignItems: 'center',
          }}
        >
          {/* Left: Copy */}
          <div className="stagger-fade-in">
            <div
              style={{
                color: 'var(--teal)',
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                marginBottom: 'var(--space-3)',
              }}
            >
              About
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-brand)',
                fontSize: 'clamp(2.2rem, 5vw, 3.2rem)',
                lineHeight: 1.05,
                marginBottom: 'var(--space-4)',
                color: 'var(--white)',
                letterSpacing: '0.02em',
              }}
            >
              Pep Nation <span style={{ color: 'var(--teal)' }}>Lab</span>
            </h1>
            <div
              style={{
                color: 'var(--teal)',
                fontSize: '0.95rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: 'var(--space-4)',
              }}
            >
              Science. Transparency. Trust.
            </div>
            <p
              style={{
                fontSize: '0.98rem',
                color: 'var(--silver)',
                lineHeight: 1.75,
                maxWidth: 460,
                marginBottom: 'var(--space-6)',
              }}
            >
              Pep Nation Lab Is A Research-First Peptide Distribution Platform Built To Support
              Qualified Researchers With Access To High-Quality Compounds, Transparent Pricing,
              And Unmatched Service.
            </p>
            <a
              href="#mission"
              className="btn btn-secondary btn-lg"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
            >
              Our Mission
              <ArrowDown size={18} />
            </a>
          </div>

          {/* Right: Molecule + Vial Artwork (Pure SVG, Fully Responsive) */}
          <div className="about-hero-art stagger-fade-in" style={{ animationDelay: '0.15s', display: 'flex', justifyContent: 'center' }}>
            <svg viewBox="0 0 420 360" width="100%" style={{ maxWidth: 440, height: 'auto', display: 'block' }} role="img" aria-label="Research Grade Peptides Vial And Molecule Illustration">
              <defs>
                <radialGradient id="abGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#00C4BC" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#00C4BC" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="abGlass" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#9FB6C6" stopOpacity="0.35" />
                  <stop offset="30%" stopColor="#E8F4F8" stopOpacity="0.5" />
                  <stop offset="60%" stopColor="#7C97A8" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#5A7484" stopOpacity="0.4" />
                </linearGradient>
                <linearGradient id="abCap" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8C9BA8" />
                  <stop offset="45%" stopColor="#DCE6ED" />
                  <stop offset="100%" stopColor="#6B7B88" />
                </linearGradient>
                <linearGradient id="abLiquid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00C4BC" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#0891B2" stopOpacity="0.75" />
                </linearGradient>
                <radialGradient id="abAtom" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#BDE9FF" />
                  <stop offset="45%" stopColor="#38BDF8" />
                  <stop offset="100%" stopColor="#0B5E8A" />
                </radialGradient>
              </defs>

              {/* Ambient Glow */}
              <circle cx="210" cy="185" r="170" fill="url(#abGlow)" />

              {/* Molecule Network */}
              <g stroke="#38BDF8" strokeOpacity="0.65" strokeWidth="2.5">
                <line x1="70" y1="120" x2="130" y2="90" />
                <line x1="130" y1="90" x2="190" y2="120" />
                <line x1="190" y1="120" x2="180" y2="185" />
                <line x1="130" y1="90" x2="140" y2="35" />
                <line x1="190" y1="120" x2="250" y2="85" />
                <line x1="250" y1="85" x2="300" y2="120" />
                <line x1="180" y1="185" x2="120" y2="215" />
                <line x1="180" y1="185" x2="235" y2="220" />
                <line x1="235" y1="220" x2="295" y2="195" />
                <line x1="295" y1="195" x2="300" y2="120" />
                <line x1="120" y1="215" x2="105" y2="270" />
                <line x1="235" y1="220" x2="250" y2="280" />
              </g>
              <g>
                {[
                  [70, 120, 13], [130, 90, 17], [190, 120, 14], [140, 35, 11],
                  [250, 85, 15], [300, 120, 12], [180, 185, 19], [120, 215, 13],
                  [235, 220, 16], [295, 195, 12], [105, 270, 10], [250, 280, 12],
                ].map(([cx, cy, r]) => (
                  <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="url(#abAtom)" />
                ))}
              </g>

              {/* Vial */}
              <g transform="translate(300, 130)">
                {/* Cap */}
                <rect x="8" y="0" width="74" height="26" rx="6" fill="url(#abCap)" />
                <rect x="14" y="26" width="62" height="10" rx="3" fill="#4E5E6B" />
                {/* Body */}
                <rect x="0" y="36" width="90" height="150" rx="14" fill="url(#abGlass)" stroke="#B9CBD8" strokeOpacity="0.55" strokeWidth="1.5" />
                {/* Liquid */}
                <rect x="6" y="120" width="78" height="60" rx="10" fill="url(#abLiquid)" />
                {/* Label */}
                <rect x="8" y="52" width="74" height="86" rx="6" fill="#F4F8FA" />
                <text x="45" y="72" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#3A4A56" letterSpacing="0.5">RESEARCH GRADE</text>
                <text x="45" y="90" textAnchor="middle" fontSize="13" fontWeight="800" fill="#111C26" letterSpacing="0.5">PEPTIDES</text>
                <circle cx="45" cy="108" r="9" fill="none" stroke="#0891B2" strokeWidth="1.5" />
                <path d="M38 108h14M45 101v14" stroke="#0891B2" strokeWidth="1" opacity="0.7" />
                <text x="45" y="130" textAnchor="middle" fontSize="8" fontWeight="600" fill="#3A4A56">Pep Nation</text>
                {/* Glow Base */}
                <ellipse cx="45" cy="196" rx="54" ry="9" fill="#00C4BC" opacity="0.3" />
              </g>
            </svg>
          </div>
        </div>
      </section>

      {/* ============ Our Mission ============ */}
      <section id="mission" className="section" style={{ paddingTop: 0, scrollMarginTop: 90 }}>
        <div className="container">
          <div
            className="glass-panel hover-lift stagger-fade-in about-mission-grid"
            style={{
              padding: 'var(--space-8)',
              display: 'grid',
              gridTemplateColumns: '170px 1fr',
              gap: 'var(--space-8)',
              alignItems: 'center',
              border: '1px solid rgba(0,196,188,0.25)',
            }}
          >
            {/* Globe Emblem */}
            <div className="about-mission-globe" style={{ display: 'flex', justifyContent: 'center' }}>
              <svg viewBox="0 0 120 120" width="140" height="140" role="img" aria-label="Pep Nation Globe Emblem">
                <defs>
                  <radialGradient id="abGlobe" cx="35%" cy="30%" r="75%">
                    <stop offset="0%" stopColor="#7FE7E2" />
                    <stop offset="55%" stopColor="#0E9C95" />
                    <stop offset="100%" stopColor="#043A3F" />
                  </radialGradient>
                </defs>
                <circle cx="60" cy="60" r="34" fill="url(#abGlobe)" />
                <g stroke="#CFE8EE" strokeWidth="1.1" fill="none" opacity="0.85">
                  <ellipse cx="60" cy="60" rx="34" ry="13" />
                  <ellipse cx="60" cy="60" rx="34" ry="26" />
                  <path d="M60 26v68M33 45h54M33 75h54" opacity="0.5" />
                </g>
                <g fill="#E8F4F0" opacity="0.9">
                  <path d="M44 48c4-5 10-7 15-5s4 7 9 8-2 8-7 9-11-2-14-5-5-4-3-7z" />
                  <path d="M64 74c4-2 9-1 10 3s-5 7-9 5-4-6-1-8z" />
                </g>
                <circle cx="60" cy="60" r="45" fill="none" stroke="#9DB4C0" strokeWidth="2.5" opacity="0.8" />
                <circle cx="60" cy="60" r="52" fill="none" stroke="#5A7484" strokeWidth="1.2" opacity="0.5" />
                {[[60, 15], [105, 60], [60, 105], [15, 60], [92, 28], [28, 92]].map(([cx, cy]) => (
                  <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" fill="#C9D6DE" />
                ))}
              </svg>
            </div>

            <div>
              <h2
                style={{
                  color: 'var(--teal)',
                  fontFamily: 'var(--font-brand)',
                  fontSize: '1.5rem',
                  letterSpacing: '0.06em',
                  marginBottom: 'var(--space-4)',
                }}
              >
                Our Mission
              </h2>
              <p style={{ fontSize: '0.95rem', color: 'var(--silver)', lineHeight: 1.8, marginBottom: 'var(--space-4)' }}>
                Research Laboratories Deserve A Supply Partner That Is Transparent About Pricing,
                Rigorous About Compliance, And Built Around The Realities Of Professional
                Research Work. Pep Nation Lab Exists To Be That Partner.
              </p>
              <p style={{ fontSize: '0.95rem', color: 'var(--silver)', lineHeight: 1.8, margin: 0 }}>
                We Operate A Streamlined Distribution Platform That Pairs A Curated Research Catalog
                With A Network Of Vetted Agents, So Qualified Researchers Can Source The Compounds
                They Need Without The Opacity And Inflated Markups Common To The Industry.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ What We Do ============ */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(160,180,192,0.4))' }} />
            <h2
              style={{
                fontFamily: 'var(--font-brand)',
                fontSize: '1.35rem',
                color: 'var(--white)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                margin: 0,
                whiteSpace: 'nowrap',
              }}
            >
              What We Do
            </h2>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(160,180,192,0.4), transparent)' }} />
          </div>

          <div
            className="about-pillars-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-5)' }}
          >
            {PILLARS.map((p, index) => (
              <div
                key={p.title}
                className="glass-panel hover-lift stagger-fade-in"
                style={{
                  padding: 'var(--space-6)',
                  textAlign: 'center',
                  animationDelay: `${0.1 + index * 0.1}s`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--teal)',
                    background: 'rgba(0,196,188,0.08)',
                    border: '1px solid rgba(0,196,188,0.3)',
                    boxShadow: '0 0 24px rgba(0,196,188,0.15)',
                    marginBottom: 'var(--space-4)',
                  }}
                >
                  {p.icon}
                </div>
                <h3
                  style={{
                    fontSize: '0.95rem',
                    marginBottom: 'var(--space-3)',
                    fontFamily: 'var(--font-brand)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--white)',
                    lineHeight: 1.4,
                  }}
                >
                  {p.title}
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--grey-400)', lineHeight: 1.7, margin: 0 }}>
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Research-Only Commitment ============ */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div
            className="glass-panel stagger-fade-in"
            style={{
              padding: 'var(--space-8)',
              border: '1px solid rgba(0,196,188,0.25)',
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-brand)',
                fontSize: '1.25rem',
                color: 'var(--white)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 'var(--space-7)',
              }}
            >
              Our Research-Only Commitment
            </h2>

            <div
              className="about-commitment-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-7)',
              }}
            >
              {COMMITMENTS.map((c, index) => (
                <div
                  key={c.label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: '0 var(--space-3)',
                    borderRight: index < COMMITMENTS.length - 1 ? '1px solid rgba(160,180,192,0.15)' : 'none',
                  }}
                  className={index < COMMITMENTS.length - 1 ? 'about-commitment-cell' : ''}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--teal)',
                      background: 'rgba(0,196,188,0.08)',
                      border: '1px solid rgba(0,196,188,0.3)',
                    }}
                  >
                    {c.icon}
                  </div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--silver-light)',
                      lineHeight: 1.5,
                    }}
                  >
                    {c.label}
                  </div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--silver)', lineHeight: 1.8, maxWidth: 860, margin: '0 auto' }}>
              All Products Distributed Through Pep Nation Lab Are Sold Strictly For In Vitro
              Laboratory Research And Analytical Purposes Only. They Are Not Intended For Human
              Or Animal Consumption, Ingestion, Or Injection, And Have Not Been Evaluated Or
              Approved By The FDA.
            </p>
          </div>
        </div>
      </section>

      {/* ============ Ready To Get Started ============ */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container-sm">
          <div
            className="glass-panel hover-lift stagger-fade-in"
            style={{
              padding: 'var(--space-8)',
              textAlign: 'center',
              border: '1px solid rgba(0,196,188,0.35)',
              boxShadow: '0 0 40px rgba(0,196,188,0.08)',
            }}
          >
            <h2
              style={{
                color: 'var(--teal)',
                fontFamily: 'var(--font-brand)',
                fontSize: '1.35rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 'var(--space-3)',
              }}
            >
              Ready To Get Started?
            </h2>
            <p style={{ fontSize: '0.92rem', color: 'var(--silver)', lineHeight: 1.7, marginBottom: 'var(--space-6)' }}>
              Already Have An Account? Sign In To Browse Your Storefront With{' '}
              <Link href="/products" style={{ color: 'var(--teal)', textDecoration: 'none' }}>
                Wholesale
              </Link>{' '}
              Pricing.
            </p>
            <Link
              href="/login"
              className="btn btn-primary btn-lg"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
            >
              <UserRound size={18} />
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ============ Compliance Badge Strip ============ */}
      <section className="section" style={{ paddingTop: 0, paddingBottom: 'var(--space-8)' }}>
        <div className="container">
          <div
            className="glass-panel about-badge-strip"
            style={{
              padding: 'var(--space-4) var(--space-6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              gap: 'var(--space-4)',
              flexWrap: 'wrap',
            }}
          >
            {[
              { label: 'Research Use Only', icon: <ShieldCheck size={18} strokeWidth={1.8} /> },
              { label: 'Not For Human Use', icon: <Shield size={18} strokeWidth={1.8} /> },
              { label: 'Laboratory Research Only', icon: <FlaskConical size={18} strokeWidth={1.8} /> },
            ].map(({ label, icon }) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  color: 'var(--silver-light)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                <span style={{ color: 'var(--teal)', display: 'flex' }}>{icon}</span>
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Responsive Collapse Rules For This Page */}
      <style>{`
        @media (max-width: 900px) {
          .about-hero-grid { grid-template-columns: 1fr !important; }
          .about-hero-art { order: -1; }
          .about-hero-art svg { max-width: 320px !important; }
          .about-pillars-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .about-commitment-grid { grid-template-columns: repeat(2, 1fr) !important; row-gap: var(--space-6) !important; }
          .about-commitment-cell { border-right: none !important; }
          .about-mission-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .about-pillars-grid { grid-template-columns: 1fr !important; }
          .about-commitment-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </PageShell>
  );
}
