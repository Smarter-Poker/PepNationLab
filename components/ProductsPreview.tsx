'use client';

import Link from 'next/link';

const SAMPLE_PRODUCTS = [
  { name: 'BPC-157', category: 'Peptide', description: 'Research-grade synthetic peptide for laboratory in vitro analysis.' },
  { name: 'TB-500', category: 'Peptide', description: 'Thymosin Beta-4 fragment for controlled in vitro research studies.' },
  { name: 'Semaglutide', category: 'GLP-1 Analog', description: 'GLP-1 receptor agonist analog for metabolic research applications.' },
  { name: 'Tirzepatide', category: 'GIP/GLP-1', description: 'Dual GIP/GLP-1 receptor agonist for advanced research protocols.' },
  { name: 'CJC-1295', category: 'GHRH Analog', description: 'Growth hormone releasing hormone analog for research use only.' },
  { name: 'Ipamorelin', category: 'Peptide', description: 'Selective GHS for in vitro growth hormone secretagogue research.' },
];

export default function ProductsPreview() {
  return (
    <section className="section" style={{ background: 'var(--black-2)' }}>
      <div className="container">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-12)' }}>
          <span className="badge badge-teal" style={{ marginBottom: 'var(--space-4)' }}>Research Catalog</span>
          <h2 style={{ marginBottom: 'var(--space-4)' }}>
            Featured Research{' '}
            <span style={{ color: 'var(--teal)' }}>Compounds</span>
          </h2>
          <p style={{ maxWidth: 500, margin: '0 auto', fontSize: '0.95rem' }}>
            All Compounds Are Research-Grade, For Qualified Researchers Only. 
            Create An Account To Access Full Catalog And Pricing.
          </p>
        </div>

        {/* Product grid */}
        <div className="grid-3">
          {SAMPLE_PRODUCTS.map((product, i) => (
            <div key={product.name} className="product-card animate-fade-up"
                 style={{ animationDelay: `${i * 80}ms` }}>
              {/* Product image placeholder */}
              <div style={{
                height: 160, 
                background: `radial-gradient(circle at ${30 + i * 10}% ${40 + i * 8}%, rgba(192,184,168,0.15) 0%, var(--surface-2) 70%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', overflow: 'hidden'
              }}>
                {/* Molecule icon */}
                <svg width="60" height="60" viewBox="0 0 60 60" fill="none" opacity={0.4}>
                  <circle cx="30" cy="30" r="8" fill="none" stroke="var(--teal)" strokeWidth="1.5"/>
                  <circle cx="15" cy="15" r="5" fill="none" stroke="var(--teal)" strokeWidth="1.5"/>
                  <circle cx="45" cy="15" r="5" fill="none" stroke="var(--silver)" strokeWidth="1.5"/>
                  <circle cx="15" cy="45" r="5" fill="none" stroke="var(--silver)" strokeWidth="1.5"/>
                  <circle cx="45" cy="45" r="5" fill="none" stroke="var(--teal)" strokeWidth="1.5"/>
                  <line x1="22" y1="22" x2="30" y2="30" stroke="var(--teal)" strokeWidth="1"/>
                  <line x1="38" y1="22" x2="30" y2="30" stroke="var(--silver)" strokeWidth="1"/>
                  <line x1="22" y1="38" x2="30" y2="30" stroke="var(--silver)" strokeWidth="1"/>
                  <line x1="38" y1="38" x2="30" y2="30" stroke="var(--teal)" strokeWidth="1"/>
                </svg>
                {/* Research only badge */}
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                }}>
                  <span className="badge badge-red" style={{ fontSize: '0.65rem' }}>Research Only</span>
                </div>
              </div>

              {/* Card body */}
              <div className="product-card-body">
                <span className="badge badge-teal" style={{ marginBottom: 'var(--space-2)', fontSize: '0.65rem' }}>
                  {product.category}
                </span>
                <h4 style={{ marginBottom: 'var(--space-2)', fontFamily: 'var(--font-brand)' }}>
                  {product.name}
                </h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>
                  {product.description}
                </p>
                
                {/* Price gate */}
                <div style={{
                  background: 'var(--surface-2)',
                  border: 'var(--border-silver)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                  textAlign: 'center',
                  cursor: 'pointer'
                }}>
                  <p style={{ 
                    fontSize: '0.78rem', 
                    color: 'var(--grey-400)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0110 0v4"/>
                    </svg>
                    Sign In To View Pricing
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', marginTop: 'var(--space-10)' }}>
          <p style={{ marginTop: 'var(--space-4)', fontSize: '0.8rem', color: 'var(--grey-400)' }}>
            50+ Research Compounds Available • Wholesale Pricing For Qualified Researchers
          </p>
        </div>
      </div>
    </section>
  );
}
