'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function FooterSection() {
  return (
    <footer style={{
      background: 'var(--black-2)',
      borderTop: '1px solid rgba(192,184,168,0.1)',
      paddingTop: 'var(--space-8)',
      paddingBottom: 'var(--space-8)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-10)', padding: '0 var(--space-4)' }}>
        <Image 
          src="/images/badges/research_use_pill_transparent.png" 
          alt="Research Use Only - Not For Human Use - Laboratory Research Only" 
          width={800}
          height={150}
          unoptimized
          style={{ maxWidth: '95%', height: 'auto', maxHeight: '150px' }} 
        />
      </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <Image src="/logo-mark.svg" alt="Pep Nation Lab" width={40} height={40} style={{ display: 'block' }} unoptimized />
              <div style={{
                fontFamily: 'var(--font-brand)',
                fontSize: '1rem',
                fontWeight: 800,
                color: 'var(--teal)',
                letterSpacing: '0.1em',
                textShadow: '0 0 20px rgba(192,184,168,0.4)'
              }}>
                PEP NATION LAB
              </div>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', lineHeight: 1.7, marginBottom: 'var(--space-4)' }}>
              Wholesale Research Peptide Distribution For Qualified Scientists And Research Institutions.
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
                { label: 'Research Library', href: '/research' },
                { label: 'Find A Peptide', href: '/find-a-peptide' },
                { label: 'Peptide 101 Academy', href: '/peptide-101' },
                { label: 'Reconstitution Calculators', href: '/research/calculators' },
                { label: 'Compare Compounds', href: '/research/compare' },
                { label: 'Products', href: '/products' },
                { label: 'Agent Dashboard', href: '/dashboard' },
                { label: 'Sign In', href: '/login' },
              ].map(({ label, href }) => (
                <Link key={label} href={href} style={{ fontSize: '0.85rem', color: 'var(--grey-400)', transition: 'color 0.2s' }}
                      onMouseOver={e => (e.currentTarget.style.color = 'var(--teal)')}
                      onMouseOut={e => (e.currentTarget.style.color = 'var(--grey-400)')}>{label}
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
                { label: 'Terms Of Service', href: '/terms' },
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Compliance', href: '/compliance' },
              ].map(({ label, href }) => (
                <Link key={label} href={href} style={{ fontSize: '0.85rem', color: 'var(--grey-400)', transition: 'color 0.2s' }}
                      onMouseOver={e => (e.currentTarget.style.color = 'var(--teal)')}
                      onMouseOut={e => (e.currentTarget.style.color = 'var(--grey-400)')}>{label}
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
            }}>Connect</h6>
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
              {/* Social links — entity consistency signals */}
              {/* OMEGA PROTOCOL EXCEPTION: Social brand profiles are an intentional exception to the IframeModal requirement. */}
              <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)', flexWrap: 'wrap' }}>
                {[
                  { href: 'https://www.linkedin.com/company/pepnationlab', label: 'LinkedIn', icon: (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  )},
                  { href: 'https://x.com/PepNationLab', label: 'X / Twitter', icon: (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.264 5.638 5.9-5.638zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  )},
                  { href: 'https://www.instagram.com/pepnationlab/', label: 'Instagram', icon: (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                  )},
                  { href: 'https://www.youtube.com/@pepnationlab', label: 'YouTube', icon: (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  )},
                  { href: 'https://www.tiktok.com/@pepnationlab', label: 'TikTok', icon: (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg>
                  )},
                ].map(({ href, label, icon }) => (
                  <a key={label} href={href} target="_blank" rel="me noopener noreferrer" aria-label={label}
                     style={{ color: 'var(--grey-400)', transition: 'color 0.2s' }}
                     onMouseOver={e => (e.currentTarget.style.color = 'var(--teal)')}
                     onMouseOut={e => (e.currentTarget.style.color = 'var(--grey-400)')}>
                    {icon}
                  </a>
                ))}
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--grey-600)', lineHeight: 1.5 }}>
                Qualified Researchers Only. All Inquiries Are Verified Before Account Approval.
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
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <strong style={{ color: 'var(--red)' }}>Research Use Only Disclaimer:</strong>{' '}
            All products sold on PepNationLab.com are strictly for <em>in vitro</em> laboratory research and analytical purposes only. 
            They are NOT intended for human or animal consumption, ingestion, or injection. 
            These products have not been evaluated or approved by the FDA. 
            Pep Nation Lab does not sell needles, syringes, or any injection delivery devices.
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
            &copy; {new Date().getFullYear()} Pep Nation Lab LLC. All Rights Reserved.
          </p>
          <p style={{ fontSize: '0.78rem', color: 'var(--grey-600)', margin: 0 }}>
            PepNationLab.com | For Qualified Researchers Only
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
