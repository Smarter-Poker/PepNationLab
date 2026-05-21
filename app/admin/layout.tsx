import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '◈' },
  { href: '/admin/products', label: 'Products', icon: '⬡' },
  { href: '/admin/researchers', label: 'Researchers', icon: '◎' },
  { href: '/admin/pricing', label: 'Pricing Tiers', icon: '◈' },
  { href: '/admin/orders', label: 'Orders', icon: '◉' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/dashboard');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)', display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240,
        minHeight: '100vh',
        background: 'var(--black-2)',
        borderRight: 'var(--border-silver)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        zIndex: 50,
      }}>
        {/* Brand */}
        <div style={{
          padding: 'var(--space-6)',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}>
          <div style={{
            fontFamily: 'var(--font-brand)',
            fontSize: '0.85rem',
            fontWeight: 800,
            letterSpacing: '0.1em',
            color: 'var(--teal)',
            textShadow: '0 0 12px rgba(0,196,188,0.3)'
          }}>
            PEP NATION LAB
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', marginTop: 4 }}>
            Admin Control Panel
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: 'var(--space-4) 0', flex: 1 }}>
          {NAV.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className="sidebar-nav-item"
              style={{ padding: 'var(--space-3) var(--space-5)' }}
            >
              <span style={{ fontSize: '0.9rem', color: 'var(--teal)' }}>{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{
          padding: 'var(--space-4) var(--space-5)',
          borderTop: '1px solid rgba(255,255,255,0.06)'
        }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginBottom: 'var(--space-2)' }}>
            Signed In As
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--silver)', marginBottom: 'var(--space-3)' }}>
            {profile?.full_name ?? user.email}
          </div>
          <Link href="/dashboard" style={{ fontSize: '0.78rem', color: 'var(--teal)', display: 'block', marginBottom: 'var(--space-2)' }}>
            ← Back To Dashboard
          </Link>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" style={{
              fontSize: '0.75rem', color: 'var(--grey-400)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0
            }}>
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ marginLeft: 240, flex: 1, minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
