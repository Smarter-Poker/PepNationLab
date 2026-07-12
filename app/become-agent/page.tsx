import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Package, Users, BarChart2, Shield } from 'lucide-react';
import PageShell from '@/components/PageShell';

export const metadata: Metadata = {
  title: 'Become A Distribution Agent | Pep Nation Lab',
  description:
    'Apply to operate your own branded peptide research supply storefront on the Pep Nation Lab platform. Earn recurring commissions by connecting qualified researchers with wholesale-priced RUO compounds.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/become-agent' },
  openGraph: {
    title: 'Become A Distribution Agent | Pep Nation Lab',
    description:
      'Build your own branded research peptide storefront. Wholesale pricing, recurring commissions, and full platform support - apply to join the Pep Nation Lab agent network.',
    url: 'https://pepnationlab.com/become-agent',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Become A Pep Nation Lab Agent' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Become A Distribution Agent | Pep Nation Lab',
    description: 'Build your own branded research peptide storefront with wholesale pricing and recurring commissions.',
    images: ['/og-card.png'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  '@id': 'https://pepnationlab.com/become-agent#webpage',
  name: 'Become A Distribution Agent',
  url: 'https://pepnationlab.com/become-agent',
  description:
    'Apply to operate a branded research peptide distribution storefront on the Pep Nation Lab platform. Earn commissions, access wholesale pricing, and serve your local research community.',
  isPartOf: { '@id': 'https://pepnationlab.com/#website' },
  publisher: { '@id': 'https://pepnationlab.com/#organization' },
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
      { '@type': 'ListItem', position: 2, name: 'Become An Agent', item: 'https://pepnationlab.com/become-agent' },
    ],
  },
};

export default function BecomeAgentPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageShell>
        <div style={{ background: 'var(--black)', minHeight: '100dvh', padding: 'var(--space-10) var(--space-4)' }}>

        {/* Hero */}
        <div className="container" style={{ maxWidth: 760, textAlign: 'center', marginBottom: 'var(--space-12)' }}>
          <h1
            className="animated-gradient-text"
            style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-4)', lineHeight: 1.15 }}
          >
            Become A Distribution Agent
          </h1>
          <p style={{ color: 'var(--silver)', fontSize: '1.05rem', lineHeight: 1.7, maxWidth: 560, margin: '0 auto var(--space-6)' }}>
            Qualified High-Volume Researchers Can Operate Their Own Branded Research-Supply Storefronts
            On The Pep Nation Lab Platform. Build A Business Backed By Our Distribution Infrastructure,
            Competitive Tier Pricing, And Compliance Framework.
          </p>
          <Link
            href="/login"
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', fontSize: '1rem' }}
          >
            Sign In To Apply
            <ChevronRight size={18} aria-hidden />
          </Link>
        </div>

        {/* Benefits */}
        <div className="container" style={{ maxWidth: 900 }}>
          <h2 style={{ color: 'var(--white)', textAlign: 'center', marginBottom: 'var(--space-8)', fontSize: '1.4rem' }}>
            What Agents Get
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
            {[
              {
                Icon: Package,
                title: 'White-Label Storefront',
                body: 'Your Own Branded URL, Colors, Logo, Tagline, And Product Catalog. Researchers See Your Brand, Not Ours.',
              },
              {
                Icon: BarChart2,
                title: 'Tier-Based Pricing',
                body: 'Tier 1, 2, And 3 Multipliers On Base Cost. Top-Performing Agents Earn The Best Margins Automatically.',
              },
              {
                Icon: Users,
                title: 'Researcher CRM',
                body: 'Manage Your Researcher Accounts, View Their Order History, And Communicate Directly Via In-App Messaging.',
              },
              {
                Icon: Shield,
                title: 'Built-In Compliance',
                body: 'Four-Layer Disclaimer Gates, Research-Use-Only Branding, And Audit-Ready Acceptance Logs Included By Default.',
              },
            ].map(({ Icon, title, body }) => (
              <div
                key={title}
                className="card-glass"
                style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)' }}
              >
                <Icon size={28} aria-hidden style={{ color: 'var(--teal)', marginBottom: 'var(--space-3)' }} />
                <h3 style={{ color: 'var(--white)', fontSize: '1rem', marginBottom: 'var(--space-2)' }}>{title}</h3>
                <p style={{ color: 'var(--silver)', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Eligibility */}
        <div className="container" style={{ maxWidth: 680, marginTop: 'var(--space-12)' }}>
          <div className="card" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)' }}>
            <h2 style={{ color: 'var(--white)', marginBottom: 'var(--space-4)', fontSize: '1.2rem' }}>Eligibility Requirements</h2>
            <ul style={{ color: 'var(--silver)', fontSize: '0.9rem', lineHeight: 2, margin: 0, paddingLeft: 'var(--space-5)' }}>
              <li>Established Relationship With A Current Pep Nation Lab Agent Or Admin</li>
              <li>Demonstrated Research Background Or Client Base</li>
              <li>Agreement To All Platform Compliance And Research-Use-Only Terms</li>
              <li>Weekly Billing Account (Credit Line Or Prepaid Balance)</li>
            </ul>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.8rem', marginTop: 'var(--space-4)', marginBottom: 0 }}>
              Agent Applications Are Reviewed Manually. All Compounds Distributed Through The Platform Are
              For Research Use Only And Not Intended For Human Consumption.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', marginTop: 'var(--space-10)' }}>
          <p style={{ color: 'var(--silver)', marginBottom: 'var(--space-4)', fontSize: '0.95rem' }}>
            Already Have An Account? Sign In And Contact Your Agent Administrator To Begin The Application Process.
          </p>
          <Link href="/login" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Sign In
            <ChevronRight size={16} aria-hidden />
          </Link>
        </div>

      </div>
      </PageShell>
    </>
  );
}
