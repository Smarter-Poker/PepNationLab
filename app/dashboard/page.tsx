import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

const ROLE_LABELS: Record<string, string> = {
  researcher: 'Researcher',
  agent: 'Agent',
  super_agent: 'Super Agent',
  admin: 'Admin',
};

const ACCOUNT_LABELS: Record<string, string> = {
  prepaid: 'Prepaid',
  credit: 'Credit',
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Get profile — includes disclaimer acceptance status
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, tier, prepaid_balance, credit_limit, account_type, disclaimer_v1_accepted')
    .eq('id', user.id)
    .single();

  const role = profile?.role ?? 'researcher';

  // Admins always go to the admin panel — never the researcher dashboard
  if (role === 'admin') redirect('/admin');

  const params = await searchParams;
  const isWelcome = params?.welcome === '1';
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
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-brand)', fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--teal)' }}>
          PEP NATION LAB
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--silver)' }}>{name}</span>
          <span className={`badge ${role === 'admin' ? 'badge-red' : role.includes('agent') ? 'badge-teal' : 'badge-silver'}`} style={{ fontSize: '0.7rem' }}>
            {ROLE_LABELS[role] ?? role}
          </span>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" style={{ fontSize: '0.8rem', color: 'var(--grey-400)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Sign Out
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
              <strong style={{ color: 'var(--teal)' }}>Welcome To Pep Nation Lab!</strong>
              <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', margin: 0 }}>Your Researcher Account Is Active. Browse Our Catalog And Place Your First Order.</p>
            </div>
          </div>
        )}

        {/* Page title */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h1 style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>
            Welcome Back, <span style={{ color: 'var(--teal)' }}>{name}</span>
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
              value: profile?.account_type ? (ACCOUNT_LABELS[profile.account_type] ?? profile.account_type) : 'Standard',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              ),
            },
            {
              label: role.includes('agent') ? 'Credit Limit' : 'Prepaid Balance',
              value: role.includes('agent')
                ? `$${(profile?.credit_limit ?? 0).toFixed(2)}`
                : `$${(profile?.prepaid_balance ?? 0).toFixed(2)}`,
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              ),
            },
            {
              label: 'Tier',
              value: profile?.tier ? `Tier ${profile.tier.replace('tier_', '')}` : 'N/A',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              ),
            },
          ].map(({ label, value, icon }) => (
            <div key={label} className="card-metal" style={{ padding: 'var(--space-5)' }}>
              <div style={{ marginBottom: 'var(--space-2)', color: 'var(--teal)' }}>{icon}</div>
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
              <Link href="/messages" className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }}>
                Messages
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
                {profile?.disclaimer_v1_accepted
                  ? <span className="badge badge-teal" style={{ fontSize: '0.65rem' }}>Accepted</span>
                  : <span className="badge badge-red" style={{ fontSize: '0.65rem' }}>Pending</span>
                }
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--grey-400)' }}>Account Role</span>
                <span style={{ color: 'var(--silver)' }}>{ROLE_LABELS[role] ?? role}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--grey-400)' }}>Username</span>
                <span style={{ color: 'var(--silver)', fontSize: '0.8rem' }}>
                  {user.email?.split('@')[0]}
                </span>
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
                  Want Better Pricing? Contact Your Administrator To Inquire About Agent Access.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
