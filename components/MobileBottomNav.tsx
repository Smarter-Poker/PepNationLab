'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { vibrate } from '@/lib/haptics';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const navItems = [
    { name: 'Home', href: '/', icon: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></> },
    { name: 'Search', href: '/research/a-z', icon: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></> },
    { name: 'Orders', href: '/orders', icon: <><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></> },
    { name: 'Account', href: '/dashboard', icon: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></> },
  ];

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 'calc(65px + env(safe-area-inset-bottom))',
      background: 'rgba(10, 16, 24, 0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 9990,
    }} className="mobile-only-flex">
      {navItems.map(item => {
        const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
        
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={() => vibrate(30)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '25%',
              height: '100%',
              color: isActive ? 'var(--teal)' : 'var(--grey-400)',
              textDecoration: 'none',
              transition: 'color 0.2s',
            }}
          >
            <svg 
              width="24" height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              style={{ marginBottom: 4 }}
            >
              {item.icon}
            </svg>
            <span style={{ fontSize: '0.65rem', fontWeight: isActive ? 600 : 400 }}>
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
