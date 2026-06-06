'use client';

import Link from 'next/link';

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
];

export default function HowItWorksSection() {
  return (
    <section className="section">
      <div className="container">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-12)' }}>
          <span className="badge badge-silver" style={{ marginBottom: 'var(--space-4)' }}>How It Works</span>
          <h2>
            Built For{' '}
            <span style={{ color: 'var(--teal)' }}>Serious Researchers</span>
          </h2>
          <p style={{ maxWidth: 480, margin: 'var(--space-4) auto 0', fontSize: '0.95rem' }}>
            From Account Creation To Compound Delivery - A Streamlined Platform 
            Designed Around The Needs Of Professional Research Labs.
          </p>
        </div>

        {/* Steps */}
        <div style={{ position: 'relative' }}>
          {/* Connector line */}
          <div style={{
            position: 'absolute',
            top: 36, left: 'calc(16.6% + 36px)', right: 'calc(16.6% + 36px)',
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(192,184,168,0.3), rgba(192,184,168,0.3), transparent)',
            pointerEvents: 'none',
            zIndex: 0
          }} />

          <div className="grid-3" style={{ position: 'relative', zIndex: 1 }}>
            {STEPS.map((step, i) => (
              <div key={step.step} className="glass-panel animate-fade-up"
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
                  boxShadow: '0 0 20px rgba(192,184,168,0.2)',
                  position: 'relative'
                }}>
                  {step.icon}
                  <div style={{
                    position: 'absolute', top: -8, right: -8,
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--teal)', color: 'var(--white)',
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
      </div>
    </section>
  );
}
