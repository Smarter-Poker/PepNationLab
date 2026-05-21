'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="nav">
      <div className="container flex-between w-full">
        {/* Logo */}
        <Link href="/" className="nav-logo" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 40%, var(--teal) 0%, var(--teal-dark) 60%, #005550 100%)',
            border: '1.5px solid var(--teal)',
            boxShadow: '0 0 10px rgba(0,196,188,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', fontWeight: 900, color: 'var(--black)',
            fontFamily: 'var(--font-brand)'
          }}>
            PNL
          </div>
          <span style={{ letterSpacing: '0.1em' }}>PEP NATION LAB</span>
        </Link>

        {/* Desktop Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}
             className="desktop-nav">
          <Link href="/products" style={{ color: 'var(--silver)', fontSize: '0.9rem', fontWeight: 500, transition: 'color 0.2s' }}
                onMouseOver={e => (e.currentTarget.style.color = 'var(--teal)')}
                onMouseOut={e => (e.currentTarget.style.color = 'var(--silver)')}>
            Products
          </Link>
          <Link href="/about" style={{ color: 'var(--silver)', fontSize: '0.9rem', fontWeight: 500, transition: 'color 0.2s' }}
                onMouseOver={e => (e.currentTarget.style.color = 'var(--teal)')}
                onMouseOut={e => (e.currentTarget.style.color = 'var(--silver)')}>
            About
          </Link>
          <Link href="/become-agent" style={{ color: 'var(--silver)', fontSize: '0.9rem', fontWeight: 500, transition: 'color 0.2s' }}
                onMouseOver={e => (e.currentTarget.style.color = 'var(--teal)')}
                onMouseOut={e => (e.currentTarget.style.color = 'var(--silver)')}>
            Become An Agent
          </Link>
          <div style={{ width: 1, height: 20, background: 'var(--surface-3)' }} />
          <Link href="/login" className="btn btn-ghost btn-sm">Sign In</Link>
          <Link href="/register" className="btn btn-primary btn-sm">
            Create Account
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--teal)', display: 'none', padding: 4
          }}
          className="mobile-menu-btn"
          aria-label="Toggle menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen
              ? <path d="M18 6L6 18M6 6l12 12"/>
              : <path d="M3 12h18M3 6h18M3 18h18"/>}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{
          position: 'absolute', top: 64, left: 0, right: 0,
          background: 'var(--black-2)',
          borderBottom: 'var(--border-teal)',
          padding: 'var(--space-4)',
          display: 'flex', flexDirection: 'column', gap: 'var(--space-2)'
        }}>
          {['Products', 'About', 'Become An Agent'].map(item => (
            <Link key={item} href={`/${item.toLowerCase().replace(/ /g, '-')}`}
                  style={{ padding: 'var(--space-3)', color: 'var(--silver)', borderRadius: 'var(--radius-md)' }}>
              {item}
            </Link>
          ))}
          <div style={{ height: 1, background: 'var(--surface-2)', margin: 'var(--space-2) 0' }} />
          <Link href="/login" className="btn btn-ghost w-full">Sign In</Link>
          <Link href="/register" className="btn btn-primary w-full">Create Account</Link>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </nav>
  );
}
