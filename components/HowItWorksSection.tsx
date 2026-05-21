'use client';

const STEPS = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
      </svg>
    ),
    step: '01',
    title: 'Create Your Researcher Account',
    description: 'Sign Up And Verify Your Researcher Credentials. Accept The Research-Only Terms And Gain Access To Our Full Catalog With Wholesale Pricing.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 01-8 0"/>
      </svg>
    ),
    step: '02',
    title: 'Browse The Research Catalog',
    description: 'Access 50+ Research Compounds With Transparent Wholesale Pricing. Filter By Category, Potency, And Availability.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
        <line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    ),
    step: '03',
    title: 'Place Your Order',
    description: 'Select Compounds, Quantities, And Pay Via Zelle, Venmo, Cash App, Or Apple Pay. Orders Are Confirmed Upon Payment Receipt.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/>
        <path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>
      </svg>
    ),
    step: '04',
    title: 'Become An Agent',
    description: 'High-Volume Researchers Can Apply To Become Agents — Operate Your Own Branded Storefront, Set Your Pricing, And Build Your Research Network.',
  },
];

export default function HowItWorksSection() {
  return (
    <section className="section">
      <div className="container">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-12)' }}>
          <span className="badge badge-silver" style={{ marginBottom: 'var(--space-4)' }}>How It Works</span>
          <h2>
            Built for{' '}
            <span style={{ color: 'var(--teal)' }}>Serious Researchers</span>
          </h2>
          <p style={{ maxWidth: 480, margin: 'var(--space-4) auto 0', fontSize: '0.95rem' }}>
            From account creation to compound delivery — a streamlined platform 
            designed around the needs of professional research labs.
          </p>
        </div>

        {/* Steps */}
        <div style={{ position: 'relative' }}>
          {/* Connector line */}
          <div style={{
            position: 'absolute',
            top: 36, left: 'calc(12.5% + 36px)', right: 'calc(12.5% + 36px)',
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(0,196,188,0.3), rgba(0,196,188,0.3), transparent)',
            pointerEvents: 'none',
            zIndex: 0
          }} />

          <div className="grid-4" style={{ position: 'relative', zIndex: 1 }}>
            {STEPS.map((step, i) => (
              <div key={step.step} className="card-metal animate-fade-up"
                   style={{ animationDelay: `${i * 100}ms`, textAlign: 'center' }}>
                {/* Step number + icon */}
                <div style={{ 
                  width: 72, height: 72, 
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--surface-2), var(--surface-3))',
                  border: '2px solid var(--teal)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto var(--space-4)',
                  color: 'var(--teal)',
                  boxShadow: '0 0 20px rgba(0,196,188,0.2)',
                  position: 'relative'
                }}>
                  {step.icon}
                  <div style={{
                    position: 'absolute', top: -8, right: -8,
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--teal)', color: 'var(--black)',
                    fontSize: '0.65rem', fontWeight: 800,
                    fontFamily: 'var(--font-brand)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {i + 1}
                  </div>
                </div>
                <h4 style={{ 
                  marginBottom: 'var(--space-3)',
                  fontFamily: 'var(--font-brand)',
                  fontSize: '0.9rem',
                  letterSpacing: '0.02em'
                }}>
                  {step.title}
                </h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', lineHeight: 1.6 }}>
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Agent CTA box */}
        <div className="card-glass" style={{ 
          marginTop: 'var(--space-12)',
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(0,196,188,0.05) 0%, rgba(15,25,35,0.95) 100%)'
        }}>
          <h3 style={{ marginBottom: 'var(--space-4)' }}>
            Ready to Run Your Own{' '}
            <span style={{ color: 'var(--teal)' }}>Research Business?</span>
          </h3>
          <p style={{ maxWidth: 600, margin: '0 auto var(--space-6)', fontSize: '0.95rem' }}>
            Qualified Researchers Can Become Agents — Get Your Own Branded Storefront At 
            <strong style={{ color: 'var(--teal)' }}> PepNationLab.com/YourName</strong>, 
            Set Your Own Pricing, Build Your Own Customer Base, And Access Wholesale Tier Pricing.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/become-agent" className="btn btn-primary btn-lg">
              Learn About Becoming An Agent
            </a>
            <a href="/register" className="btn btn-secondary btn-lg">
              Start As A Researcher
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
