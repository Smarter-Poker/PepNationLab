import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import React from 'react';

export default async function ShippingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Verify user is shipping or admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'shipping' && profile.role !== 'admin')) {
    redirect('/dashboard');
  }

  return (
    <div className="admin-layout" style={{ display: 'flex', minHeight: 'calc(100dvh - 72px)', background: 'var(--black)', maxWidth: '100vw', overflowX: 'hidden' }}>
      {/* Sidebar */}
      <aside className="glass-panel stagger-fade-in" style={{ 
        width: 260, 
        padding: 'var(--space-6)', 
        borderRight: 'var(--border-teal)', 
        borderRadius: 0, 
        borderLeft: 'none', 
        borderTop: 'none', 
        borderBottom: 'none' 
      }}>
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h2 className="animated-gradient-text" style={{ fontSize: '1.2rem', fontFamily: 'var(--font-brand)', color: 'var(--white)', letterSpacing: '0.05em', marginBottom: 4 }}>
            Shipping Portal
          </h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--teal)' }}>Fulfillment Dashboard</div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <a href="/shipping" className="btn btn-ghost w-full" style={{ justifyContent: 'flex-start', color: 'var(--white)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            Pending Orders
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main style={{ flexGrow: 1, padding: 'var(--space-8)', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
