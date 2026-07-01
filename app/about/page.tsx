import type { Metadata } from 'next';
import Link from 'next/link';
import PageShell from '@/components/PageShell';

export const metadata: Metadata = {
  title: 'About | Pep Nation Lab',
  description:
    'Pep Nation Lab is a wholesale research peptide distribution platform built for qualified researchers, laboratories, and institutional purchasers.',
};

const VALUES = [
  {
    title: 'Wholesale Distribution',
    body: 'We Connect Qualified Researchers And Institutions With Research Compounds At Transparent Wholesale Pricing, Removing The Markup Layers Of Traditional Supply Chains.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    title: 'Research-Grade Compounds',
    body: 'Every Compound In Our Catalog Is Intended Strictly For In Vitro Laboratory Research And Analytical Science. We Do Not Sell Consumer Health Products.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12" />
        <path d="M9 3v6l-5 9a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-5-9V3" />
      </svg>
    ),
  },
  {
    title: 'Agent Network',
    body: 'Qualified High-Volume Researchers Can Operate Their Own Branded Storefronts As Agents, Building Research-Supply Businesses On Top Of Our Distribution Platform.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: 'Transparent Pricing',
    body: 'Tier-Based Pricing Multipliers Are Configurable And Consistent. Researchers And Agents Always See Exactly How A Price Is Derived From Base Cost.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
];

export default function AboutPage() {
  return (
    <PageShell>
      {/* Hero */}
      <section className="section" style={{ paddingBottom: 'var(--space-8)' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <span className="badge badge-silver" style={{ marginBottom: 'var(--space-4)' }}>
            About Us
          </span>
          <h1 className="animated-gradient-text" style={{ fontSize: '2.4rem', marginBottom: 'var(--space-4)' }}>
            About <span style={{ color: 'var(--teal)' }}>Pep Nation Lab</span>
          </h1>
          <p style={{ maxWidth: 620, margin: '0 auto', fontSize: '1rem', color: 'var(--silver)', lineHeight: 1.7 }}>
            Pep Nation Lab Is A Wholesale Research Peptide Distribution Platform Built For
            Qualified Researchers, Laboratories, And Institutional Purchasers.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container-sm">
          <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-8)' }}>
            <h2 className="animated-gradient-text" style={{ marginBottom: 'var(--space-4)', fontSize: '1.3rem' }}>
              Our <span style={{ color: 'var(--teal)' }}>Mission</span>
            </h2>
            <p style={{ fontSize: '0.95rem', color: 'var(--silver)', lineHeight: 1.8, marginBottom: 'var(--space-4)' }}>
              Research Laboratories Deserve A Supply Partner That Is Transparent About Pricing,
              Rigorous About Compliance, And Built Around The Realities Of Professional Research
              Work. Pep Nation Lab Exists To Be That Partner.
            </p>
            <p style={{ fontSize: '0.95rem', color: 'var(--silver)', lineHeight: 1.8, margin: 0 }}>
              We Operate A Streamlined Distribution Platform That Pairs A Curated Research Catalog
              With A Network Of Vetted Agents, So Qualified Researchers Can Source The Compounds
              They Need Without The Opacity And Inflated Markups Common To The Industry.
            </p>
          </div>
        </div>
      </section>

      {/* What We Do */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
            <h2 className="animated-gradient-text" style={{ fontSize: '1.3rem' }}>
              What We <span style={{ color: 'var(--teal)' }}>Do</span>
            </h2>
          </div>
          <div className="grid-2">
            {VALUES.map((v, index) => (
              <div key={v.title} className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-6)', animationDelay: `${0.1 + index * 0.1}s` }}>
                <div style={{ color: 'var(--teal)', marginBottom: 'var(--space-3)' }}>{v.icon}</div>
                <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-brand)' }}>
                  {v.title}
                </h3>
                <p style={{ fontSize: '0.86rem', color: 'var(--grey-400)', lineHeight: 1.7, margin: 0 }}>
                  {v.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Research-only commitment */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container-sm">
          <div className="glass-panel hover-lift stagger-fade-in"
            style={{
              background: 'var(--red-bg)',
              border: '1px solid rgba(229,62,62,0.25)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-8)',
              animationDelay: '0.2s',
            }}
          >
            <h2 style={{ fontSize: '1.2rem', color: 'var(--red)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-brand)' }}>
              Our Research-Only Commitment
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--silver)', lineHeight: 1.8, marginBottom: 'var(--space-3)' }}>
              All products distributed through Pep Nation Lab are sold strictly for in vitro
              laboratory research and analytical purposes. They are not intended for human or
              animal consumption, ingestion, or injection, and have not been evaluated or approved
              by the FDA.
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--silver)', lineHeight: 1.8, margin: 0 }}>
              Pep Nation Lab Strictly Prohibits The Sale Of Needles, Syringes, Or Any Medical
              Injection Delivery Devices By Our Company Or Our Agents. We Only Provide
              Research-Grade Peptides And Authorized Laboratory Diluents Exclusively For In
              Vitro Testing. Compliance Is Not A Formality For Us - It Is The Foundation The
              Platform Is Built On.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 className="animated-gradient-text" style={{ fontSize: '1.3rem', marginBottom: 'var(--space-4)' }}>
            Ready To <span style={{ color: 'var(--teal)' }}>Get Started?</span>
          </h2>
          <p style={{ maxWidth: 520, margin: '0 auto var(--space-6)', fontSize: '0.92rem', color: 'var(--grey-400)', lineHeight: 1.7 }}>
            Already Have An Account? Sign In To Browse Your Storefront With Wholesale Pricing.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" className="btn btn-primary btn-lg">
              Sign In
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
