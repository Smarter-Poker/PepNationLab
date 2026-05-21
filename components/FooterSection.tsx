'use client';

import Link from 'next/link';

export default function FooterSection() {
  return (
    <footer style={{
      background: 'var(--black-2)',
      borderTop: '1px solid rgba(0,196,188,0.1)',
      paddingTop: 'var(--space-12)',
      paddingBottom: 'var(--space-8)'
    }}>
      <div className="container">
        {/* Top row */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: 'var(--space-8)',
          marginBottom: 'var(--space-10)'
        }}>
          {/* Brand column */}
          <div style={{ gridColumn: 'span 1' }}>
            <div style={{ 
              fontFamily: 'var(--font-brand)', 
              fontSize: '1rem', 
              fontWeight: 800,
              color: 'var(--teal)', 
              letterSpacing: '0.1em',
              marginBottom: 'var(--space-4)',
              textShadow: '0 0 20px rgba(0,196,188,0.4)'
            }}>
              PEP NATION LAB
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', lineHeight: 1.7, marginBottom: 'var(--space-4)' }}>
              Wholesale research peptide distribution for qualified scientists and research institutions.
            </p>
            <div className="badge badge-red" style={{ fontSize: '0.65rem' }}>
              Research Use Only
            </div>
          </div>

          {/* Platform links */}
          <div>
            <h6 style={{ 
              color: 'var(--silver-light)', 
              marginBottom: 'var(--space-4)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontSize: '0.75rem'
            }}>Platform</h6>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {[
                { label: 'Products', href: '/products' },
                { label: 'Become an Agent', href: '/become-agent' },
                { label: 'Agent Dashboard', href: '/dashboard' },
                { label: 'Create Account', href: '/register' },
              ].map(({ label, href }) => (
                <Link key={label} href={href} style={{ fontSize: '0.85rem', color: 'var(--grey-400)', transition: 'color 0.2s' }}
                      onMouseOver={e => (e.currentTarget.style.color = 'var(--teal)')}
                      onMouseOut={e => (e.currentTarget.style.color = 'var(--grey-400)')}>
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div>
            <h6 style={{ 
              color: 'var(--silver-light)', 
              marginBottom: 'var(--space-4)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontSize: '0.75rem'
            }}>Legal</h6>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {[
                { label: 'Research-Only Disclaimer', href: '/disclaimer' },
                { label: 'Terms of Service', href: '/terms' },
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Compliance', href: '/compliance' },
              ].map(({ label, href }) => (
                <Link key={label} href={href} style={{ fontSize: '0.85rem', color: 'var(--grey-400)', transition: 'color 0.2s' }}
                      onMouseOver={e => (e.currentTarget.style.color = 'var(--teal)')}
                      onMouseOut={e => (e.currentTarget.style.color = 'var(--grey-400)')}>
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h6 style={{ 
              color: 'var(--silver-light)', 
              marginBottom: 'var(--space-4)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontSize: '0.75rem'
            }}>Contact</h6>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <a href="mailto:research@pepnationlab.com" style={{ 
                fontSize: '0.85rem', color: 'var(--grey-400)', 
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                transition: 'color 0.2s'
              }}
                 onMouseOver={e => (e.currentTarget.style.color = 'var(--teal)')}
                 onMouseOut={e => (e.currentTarget.style.color = 'var(--grey-400)')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                research@pepnationlab.com
              </a>
              <p style={{ fontSize: '0.82rem', color: 'var(--grey-600)', lineHeight: 1.5 }}>
                Qualified researchers only. All inquiries are verified before account approval.
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer bar */}
        <div style={{
          background: 'var(--red-bg)',
          border: '1px solid rgba(229,62,62,0.2)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)',
          marginBottom: 'var(--space-8)'
        }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--grey-400)', lineHeight: 1.7, textAlign: 'center' }}>
            <strong style={{ color: 'var(--red)' }}>⚠ Research Use Only Disclaimer:</strong>{' '}
            All products sold on PepNationLab.com are strictly for <em>in vitro</em> laboratory research and analytical purposes only. 
            They are NOT intended for human or animal consumption, ingestion, or injection. 
            These products have not been evaluated or approved by the FDA. 
            Pep Nation Lab does not sell BAC water, needles, syringes, or any injection delivery devices. 
            Purchasers assume full legal responsibility for compliance with all applicable laws.
          </p>
        </div>

        {/* Bottom bar */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          paddingTop: 'var(--space-4)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          flexWrap: 'wrap',
          gap: 'var(--space-4)'
        }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--grey-600)', margin: 0 }}>
            © {new Date().getFullYear()} Pep Nation Lab LLC. All Rights Reserved.
          </p>
          <p style={{ fontSize: '0.78rem', color: 'var(--grey-600)', margin: 0 }}>
            pepnationlab.com | For qualified researchers only
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          footer .container > div:first-child {
            grid-template-columns: 1fr 1fr !important;
          }
          footer .container > div:first-child > div:first-child {
            grid-column: span 2 !important;
          }
        }
      `}</style>
    </footer>
  );
}
