import type { Metadata } from 'next';
import Link from 'next/link';
import PageShell from '@/components/PageShell';

export const metadata: Metadata = {
  title: 'Become An Agent | Pep Nation Lab',
  description:
    'Run your own branded research-supply storefront. Learn how qualified researchers become Pep Nation Lab agents.',
};

const BENEFITS = [
  {
    title: 'Your Own Branded Storefront',
    body: 'Operate a white-label storefront at pepnationlab.com/yourname, with your display name, tagline, colors, and bio.',
  },
  {
    title: 'Wholesale Tier Pricing',
    body: 'Agents access tiered wholesale pricing that improves as your volume and standing grow, so your margins are yours to set.',
  },
  {
    title: 'Built-In Customer Network',
    body: 'Every researcher who registers through your storefront link or QR code is permanently tied to you as a referral.',
  },
  {
    title: 'Order And Settlement Tools',
    body: 'Track referred customers, review orders, confirm offline payments, and follow weekly statements from one dashboard.',
  },
];

const TIERS = [
  {
    name: 'Tier 1',
    label: 'Premium',
    body: 'The strongest wholesale pricing, reserved for top-performing, high-volume agents with a proven track record.',
  },
  {
    name: 'Tier 2',
    label: 'Standard',
    body: 'Balanced wholesale pricing for established agents who are consistently growing their research network.',
  },
  {
    name: 'Tier 3',
    label: 'Entry',
    body: 'The starting tier for newly approved agents. Move up as your order volume and standing increase.',
  },
];

const STEPS = [
  'Create a verified researcher account and complete the research-only acknowledgment.',
  'Request an agent upgrade. The Pep Nation Lab team reviews and approves qualified applicants.',
  'Receive your branded storefront, URL slug, and a scannable QR code for marketing.',
  'Share your storefront with your research network and start receiving orders.',
  'Confirm offline payments, release orders for fulfillment, and settle your weekly statement.',
];

export default function BecomeAgentPage() {
  return (
    <PageShell>
      {/* Hero */}
      <section className="section" style={{ paddingBottom: 'var(--space-8)' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <span className="badge badge-teal" style={{ marginBottom: 'var(--space-4)' }}>
            Agent Program
          </span>
          <h1 style={{ fontSize: '2.4rem', marginBottom: 'var(--space-4)' }}>
            Run Your Own <span style={{ color: 'var(--teal)' }}>Research Business</span>
          </h1>
          <p style={{ maxWidth: 620, margin: '0 auto var(--space-6)', fontSize: '1rem', color: 'var(--silver)', lineHeight: 1.7 }}>
            Qualified Researchers Can Become Pep Nation Lab Agents — Operate A Branded Storefront,
            Access Wholesale Tier Pricing, And Build Your Own Research-Supply Network.
          </p>
          <Link href="/login" className="btn btn-primary btn-lg">
            Sign In To Your Account
          </Link>
        </div>
      </section>

      {/* Benefits */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
            <h2 style={{ fontSize: '1.3rem' }}>
              Why Become <span style={{ color: 'var(--teal)' }}>An Agent</span>
            </h2>
          </div>
          <div className="grid-2">
            {BENEFITS.map((b) => (
              <div key={b.title} className="card-metal" style={{ padding: 'var(--space-6)' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-brand)', color: 'var(--teal)' }}>
                  {b.title}
                </h3>
                <p style={{ fontSize: '0.86rem', color: 'var(--grey-400)', lineHeight: 1.7, margin: 0 }}>
                  {b.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: 'var(--space-2)' }}>
              Three Pricing <span style={{ color: 'var(--teal)' }}>Tiers</span>
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--grey-400)', maxWidth: 520, margin: '0 auto' }}>
              Every Agent Is Assigned A Pricing Tier. Exact Multipliers Are Set By The Pep Nation
              Lab Team And Improve As You Grow.
            </p>
          </div>
          <div className="grid-3">
            {TIERS.map((t) => (
              <div key={t.name} className="card-metal" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-brand)', fontSize: '1.4rem', color: 'var(--teal)', fontWeight: 800 }}>
                  {t.name}
                </div>
                <div className="badge badge-silver" style={{ margin: 'var(--space-2) 0 var(--space-3)', fontSize: '0.65rem' }}>
                  {t.label}
                </div>
                <p style={{ fontSize: '0.84rem', color: 'var(--grey-400)', lineHeight: 1.7, margin: 0 }}>
                  {t.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container-sm">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
            <h2 style={{ fontSize: '1.3rem' }}>
              How It <span style={{ color: 'var(--teal)' }}>Works</span>
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {STEPS.map((step, i) => (
              <div
                key={i}
                className="card-metal"
                style={{ padding: 'var(--space-5)', display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}
              >
                <div
                  style={{
                    minWidth: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: 'var(--teal)',
                    color: 'var(--black)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-brand)',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--silver)', lineHeight: 1.7, margin: 0, paddingTop: 5 }}>
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Payment model */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container-sm">
          <div className="card-glass" style={{ padding: 'var(--space-8)' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-4)' }}>
              Flexible <span style={{ color: 'var(--teal)' }}>Settlement</span>
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--silver)', lineHeight: 1.8, marginBottom: 'var(--space-3)' }}>
              Agents operate on one of two account models. Credit agents maintain a line of credit
              and settle their balance on a weekly statement. Prepaid agents maintain a prepaid
              balance that orders draw against.
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--silver)', lineHeight: 1.8, margin: 0 }}>
              All payments move through Zelle, Venmo, Cash App, or Apple Pay. There is no credit
              card processing anywhere on the platform.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: 'var(--space-4)' }}>
            Ready To <span style={{ color: 'var(--teal)' }}>Apply?</span>
          </h2>
          <p style={{ maxWidth: 520, margin: '0 auto var(--space-6)', fontSize: '0.92rem', color: 'var(--grey-400)' }}>
            Start By Creating A Researcher Account. To Request An Agent Upgrade, Contact The Pep
            Nation Lab Team And Our Staff Will Review Your Application.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" className="btn btn-primary btn-lg">
              Sign In To Access Your Account
            </Link>
            <a href="mailto:research@pepnationlab.com?subject=Agent%20Application" className="btn btn-secondary btn-lg">
              Contact Us To Apply
            </a>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
