'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useCart } from './CartContext';
import { createClient } from '@/lib/supabase/client';

export default function Navbar() {
  const { cartCount, setIsCartOpen } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [profile, setProfile] = useState<{ full_name?: string | null; role?: string; tier?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        supabase
          .from('profiles')
          .select('full_name, role, tier')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data) setProfile(data);
            setLoading(false);
          });
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUser(session.user);
        supabase
          .from('profiles')
          .select('full_name, role, tier')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data) setProfile(data);
          });
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const role = profile?.role ?? 'researcher';

  return (
    <nav className="nav">
      <div className="container flex-between w-full">
        {/* Logo */}
        <Link href="/" className="nav-logo" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Image
            src="/logo-mark.svg"
            alt="Pep Nation Lab"
            width={38}
            height={38}
            priority
            style={{ display: 'block' }}
          />
          <span style={{ letterSpacing: '0.1em' }}>PEP NATION LAB</span>
        </Link>

        {/* Desktop Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }} className="desktop-nav">
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
          
          {role === 'researcher' && (
            <Link href="/become-agent" style={{ color: 'var(--silver)', fontSize: '0.9rem', fontWeight: 500, transition: 'color 0.2s' }}
                  onMouseOver={e => (e.currentTarget.style.color = 'var(--teal)')}
                  onMouseOut={e => (e.currentTarget.style.color = 'var(--silver)')}>
              Become An Agent
            </Link>
          )}

          <div style={{ width: 1, height: 20, background: 'var(--surface-3)' }} />

          {/* Cart Button */}
          <button 
            onClick={() => setIsCartOpen(true)}
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              background: 'var(--surface-2)',
              border: '1.5px solid var(--teal)',
              boxShadow: '0 0 10px rgba(192, 184, 168, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.2s',
              marginRight: 'var(--space-2)'
            }}
            onMouseOver={e => {
              e.currentTarget.style.boxShadow = '0 0 18px rgba(192, 184, 168, 0.6)';
              e.currentTarget.style.borderColor = 'var(--white)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.boxShadow = '0 0 10px rgba(192, 184, 168, 0.3)';
              e.currentTarget.style.borderColor = 'var(--teal)';
            }}
            aria-label="Open Cart"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
            </svg>
            {cartCount > 0 && (
              <span style={{
                position: 'absolute',
                top: -4,
                right: -4,
                background: 'var(--teal)',
                color: 'var(--white)',
                fontSize: '0.72rem',
                fontWeight: 900,
                borderRadius: '50%',
                width: 18,
                height: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-brand)',
                boxShadow: '0 0 8px var(--teal)',
              }}>
                {cartCount}
              </span>
            )}
          </button>

          {loading ? (
            <div style={{ width: 120, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--surface-2)' }} className="skeleton" />
          ) : user ? (
            <>
              {role === 'admin' ? (
                <Link href="/admin" className="btn btn-ghost btn-sm">Admin Panel</Link>
              ) : role.includes('agent') ? (
                <Link href="/dashboard/agent" className="btn btn-ghost btn-sm">Agent Dashboard</Link>
              ) : (
                <Link href="/dashboard" className="btn btn-ghost btn-sm">Dashboard</Link>
              )}
              <button onClick={handleSignOut} className="btn btn-secondary btn-sm">
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">Sign In</Link>
              <Link href="/become-agent" className="btn btn-primary btn-sm">
                Become An Agent
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu trigger + cart */}
        <div style={{ display: 'none', alignItems: 'center', gap: 'var(--space-3)' }} className="mobile-actions-wrapper">
          {/* Mobile Cart Button */}
          <button 
            onClick={() => setIsCartOpen(true)}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--surface-2)',
              border: '1.5px solid var(--teal)',
              boxShadow: '0 0 8px rgba(192, 184, 168, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.2s',
            }}
            aria-label="Open Cart"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
            </svg>
            {cartCount > 0 && (
              <span style={{
                position: 'absolute',
                top: -3,
                right: -3,
                background: 'var(--teal)',
                color: 'var(--white)',
                fontSize: '0.65rem',
                fontWeight: 900,
                borderRadius: '50%',
                width: 15,
                height: 15,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-brand)',
                boxShadow: '0 0 6px var(--teal)',
              }}>
                {cartCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--teal)', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            aria-label="Toggle Menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileOpen
                ? <path d="M18 6L6 18M6 6l12 12"/>
                : <path d="M3 12h18M3 6h18M3 18h18"/>}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{
          position: 'absolute',
          top: 64, left: 0, right: 0,
          background: 'var(--black-2)',
          borderBottom: 'var(--border-teal)',
          padding: 'var(--space-5)',
          display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
          boxShadow: '0 10px 20px rgba(0,0,0,0.8)',
          zIndex: 99
        }}>
          <Link href="/products" onClick={() => setMobileOpen(false)} style={{ padding: 'var(--space-3)', color: 'var(--silver)', borderRadius: 'var(--radius-md)', fontWeight: 500 }}>
            Products
          </Link>
          <Link href="/about" onClick={() => setMobileOpen(false)} style={{ padding: 'var(--space-3)', color: 'var(--silver)', borderRadius: 'var(--radius-md)', fontWeight: 500 }}>
            About
          </Link>
          
          {role === 'researcher' && (
            <Link href="/become-agent" onClick={() => setMobileOpen(false)} style={{ padding: 'var(--space-3)', color: 'var(--silver)', borderRadius: 'var(--radius-md)', fontWeight: 500 }}>
              Become An Agent
            </Link>
          )}

          <div style={{ height: 1, background: 'var(--surface-2)', margin: 'var(--space-2) 0' }} />
          
          {loading ? (
            <div style={{ height: 40, borderRadius: 'var(--radius-md)', background: 'var(--surface-2)' }} className="skeleton" />
          ) : user ? (
            <>
              {role === 'admin' ? (
                <Link href="/admin" onClick={() => setMobileOpen(false)} className="btn btn-ghost w-full">Admin Panel</Link>
              ) : role.includes('agent') ? (
                <Link href="/dashboard/agent" onClick={() => setMobileOpen(false)} className="btn btn-ghost w-full">Agent Dashboard</Link>
              ) : (
                <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="btn btn-ghost w-full">Dashboard</Link>
              )}
              <button onClick={() => { setMobileOpen(false); handleSignOut(); }} className="btn btn-secondary w-full">
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMobileOpen(false)} className="btn btn-ghost w-full">Sign In</Link>
              <Link href="/become-agent" onClick={() => setMobileOpen(false)} className="btn btn-primary w-full">Become An Agent</Link>
            </>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-actions-wrapper { display: flex !important; }
        }
      `}</style>
    </nav>
  );
}
