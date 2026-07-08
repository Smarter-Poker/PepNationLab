import type { Metadata } from 'next';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { Mail, MessageSquare, ShieldCheck, Building2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact Pep Nation Lab | Research Peptide Support',
  description:
    'Contact Pep Nation Lab for support, partnership, or research inquiries. Qualified researchers only. All inquiries verified before account approval.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/contact' },
  openGraph: {
    title: 'Contact Pep Nation Lab | Research Peptide Support',
    description: 'Get in touch with Pep Nation Lab for research support, partnership, or account inquiries.',
    url: 'https://pepnationlab.com/contact',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Contact Pep Nation Lab' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Pep Nation Lab',
    description: 'Research support, partnership, and account inquiries for qualified researchers.',
    images: ['/og-card.png'],
  },
};

const contactJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  name: 'Contact Pep Nation Lab',
  url: 'https://pepnationlab.com/contact',
  description: 'Contact Pep Nation Lab for research support, partnership, or account inquiries.',
  publisher: { '@id': 'https://pepnationlab.com/#organization' },
};

export default function ContactPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
            { '@type': 'ListItem', position: 2, name: 'Contact', item: 'https://pepnationlab.com/contact' },
          ],
        }) }}
      />
      <PageShell>
      <section className="section">
        <div className="container-sm">
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }} className="stagger-fade-in">
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
              Contact
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-brand)',
                fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
                color: 'var(--white)',
                marginBottom: 'var(--space-3)',
              }}
            >
              Get In Touch
            </h1>
            <p style={{ fontSize: '0.95rem', color: 'var(--silver)', lineHeight: 1.7, maxWidth: 520, margin: '0 auto' }}>
              Qualified Researchers Only. All Inquiries Are Verified Before Account Approval.
            </p>
          </div>

          {/* Email Support Card */}
          <div
            className="glass-panel hover-lift stagger-fade-in"
            style={{
              padding: 'var(--space-8)',
              textAlign: 'center',
              border: '1px solid rgba(0,196,188,0.3)',
              marginBottom: 'var(--space-6)',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--teal)',
                background: 'rgba(0,196,188,0.08)',
                border: '1px solid rgba(0,196,188,0.3)',
                marginBottom: 'var(--space-4)',
              }}
            >
              <Mail size={28} strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--white)', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-brand)', letterSpacing: '0.06em' }}>
              Email Support
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--grey-400)', lineHeight: 1.7, marginBottom: 'var(--space-5)' }}>
              The Fastest Way To Reach The Pep Nation Lab Team For Account, Order, Or Platform Questions.
            </p>
            <a
              href="mailto:support@pepnationlab.com"
              className="btn btn-primary btn-lg"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
            >
              <Mail size={18} />
              support@pepnationlab.com
            </a>
          </div>

          {/* Secondary Options */}
          <div
            className="contact-options-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-5)' }}
          >
            {[
              {
                title: 'Account Holders',
                body: 'Signed-In Researchers And Agents Can Message Their Store Directly From The In-App Messenger.',
                cta: 'Open Messenger',
                href: '/messenger',
                icon: <MessageSquare size={24} strokeWidth={1.5} />,
              },
              {
                title: 'Become An Agent',
                body: 'Qualified High-Volume Researchers Can Apply To Operate Their Own Branded Storefront.',
                cta: 'Apply Now',
                href: '/become-agent',
                icon: <Building2 size={24} strokeWidth={1.5} />,
              },
              {
                title: 'Compliance',
                body: 'Review Our Research-Only Policies, Terms Of Service, And Privacy Commitments.',
                cta: 'View Compliance',
                href: '/compliance',
                icon: <ShieldCheck size={24} strokeWidth={1.5} />,
              },
            ].map((c, index) => (
              <div
                key={c.title}
                className="glass-panel hover-lift stagger-fade-in"
                style={{
                  padding: 'var(--space-6)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  animationDelay: `${0.1 + index * 0.1}s`,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--teal)',
                    background: 'rgba(0,196,188,0.08)',
                    border: '1px solid rgba(0,196,188,0.3)',
                    marginBottom: 'var(--space-4)',
                  }}
                >
                  {c.icon}
                </div>
                <h3 style={{ fontSize: '0.95rem', color: 'var(--white)', marginBottom: 'var(--space-3)', fontFamily: 'var(--font-brand)', letterSpacing: '0.06em' }}>
                  {c.title}
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--grey-400)', lineHeight: 1.7, marginBottom: 'var(--space-4)', flex: 1 }}>
                  {c.body}
                </p>
                <Link href={c.href} className="btn btn-secondary btn-sm">
                  {c.cta}
                </Link>
              </div>
            ))}
          </div>

          <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--grey-600)', marginTop: 'var(--space-8)', lineHeight: 1.6 }}>
            All Products Are For In Vitro Laboratory Research Use Only. Not For Human Or Animal Use.
          </p>
        </div>
      </section>

      <style>{`
        @media (max-width: 800px) {
          .contact-options-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      </PageShell>
    </>
  );
}
