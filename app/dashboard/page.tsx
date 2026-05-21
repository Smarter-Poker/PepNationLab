import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, tier, prepaid_balance, credit_limit, account_type')
    .eq('id', user.id)
    .single();

  const params = await searchParams;
  const isWelcome = params?.welcome === '1';
  const role = profile?.role ?? 'researcher';
  const name = profile?.full_name ?? user.email?.split('@')[0] ?? 'Researcher';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
      {/* Top bar */}
      <nav style={{
        height: 64,
        background: 'var(--black-2)',
        borderBottom: 'var(--border-silver)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-6)'
      }}>
        <Link href="/" style={{ fontFamily: 'var(--font-brand)', fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--teal)' }}>
          PEP NATION LAB
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--silver)' }}>{name}</span>
          <span className={`badge ${role === 'admin' ? 'badge-red' : role.includes('agent') ? 'badge-teal' : 'badge-silver'}`} style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}>
            {role.replace('_', ' ')}
          </span>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" style={{ fontSize: '0.8rem', color: 'var(--grey-400)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Sign out
            </button>
          </form>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-8)' }}>
        {/* Welcome banner */}
        {isWelcome && (
          <div style={{
            background: 'rgba(0,196,188,0.08)',
            border: '1px solid rgba(0,196,188,0.25)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4) var(--space-6)',
            marginBottom: 'var(--space-8)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <div>
              <strong style={{ color: 'var(--teal)' }}>Welcome to Pep Nation Lab!</strong>
              <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', margin: 0 }}>Your researcher account is active. Browse our catalog and place your first order.</p>
            </div>
          </div>
        )}

        {/* Page title */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h1 style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>
            Welcome back, <span style={{ color: 'var(--teal)' }}>{name}</span>
          </h1>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem' }}>
            Researcher Dashboard — Research Use Only
          </p>
        </div>

        {/* Stats row */}
        <div className="grid-3" style={{ marginBottom: 'var(--space-8)' }}>
          {[
            {
              label: 'Account Type',
              value: profile?.account_type ? profile.account_type.replace('_', ' ') : 'Standard',
              icon: '👤',
            },
            {
              label: role.includes('agent') ? 'Credit Limit' : 'Prepaid Balance',
              value: role.includes('agent')
                ? `$${(profile?.credit_limit ?? 0).toFixed(2)}`
                : `$${(profile?.prepaid_balance ?? 0).toFixed(2)}`,
              icon: '💳',
            },
            {
              label: 'Tier',
              value: profile?.tier ? `Tier ${profile.tier.replace('tier_', '')}` : 'N/A',
              icon: '⭐',
            },
          ].map(({ label, value, icon }) => (
            <div key={label} className="card-metal" style={{ padding: 'var(--space-5)' }}>
              <div style={{ fontSize: '1.4rem', marginBottom: 'var(--space-2)' }}>{icon}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'var(--font-brand)', color: 'var(--teal)', marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid-2">
          <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ marginBottom: 'var(--space-4)', fontSize: '1rem' }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Link href="/products" className="btn btn-primary btn-sm" style={{ justifyContent: 'flex-start' }}>
                Browse Research Catalog
              </Link>
              <Link href="/orders" className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }}>
                View My Orders
              </Link>
              {role.includes('agent') && (
                <Link href="/dashboard/agent" className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }}>
                  Agent Dashboard
                </Link>
              )}
            </div>
          </div>

          <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ marginBottom: 'var(--space-4)', fontSize: '1rem' }}>Account Status</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--grey-400)' }}>Disclaimer</span>
                <span className="badge badge-teal" style={{ fontSize: '0.65rem' }}>✓ Accepted</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--grey-400)' }}>Account Role</span>
                <span style={{ color: 'var(--silver)', textTransform: 'capitalize' }}>{role.replace('_', ' ')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--grey-400)' }}>Email</span>
                <span style={{ color: 'var(--silver)', fontSize: '0.8rem' }}>{user.email}</span>
              </div>
            </div>

            {role === 'researcher' && (
              <div style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-3)',
                background: 'rgba(0,196,188,0.05)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(0,196,188,0.15)'
              }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', margin: 0 }}>
                  Want better pricing?{' '}
                  <Link href="/become-agent" style={{ color: 'var(--teal)' }}>
                    Apply to become an agent →
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
