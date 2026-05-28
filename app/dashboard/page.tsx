import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ResearcherDashboard from '@/components/ResearcherDashboard';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, tier, prepaid_balance, credit_limit, account_type, disclaimer_v1_accepted, phone, referring_agent_id')
    .eq('id', user.id)
    .single();

  const role = profile?.role ?? 'researcher';

  // Role-based routing
  if (role === 'admin') redirect('/admin');
  if (role === 'shipping') redirect('/shipping');
  if (role === 'agent' || role === 'super_agent') redirect('/dashboard/agent');

  const params = await searchParams;
  const isWelcome = params?.welcome === '1';
  const name = profile?.full_name ?? user.email?.split('@')[0] ?? 'Researcher';

  // Get referring agent info
  let agentId: string | null = profile?.referring_agent_id ?? null;
  let agentName: string | null = null;
  if (agentId) {
    const { data: agent } = await supabase.from('profiles').select('full_name').eq('id', agentId).single();
    agentName = agent?.full_name ?? null;
  }

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
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-brand)', fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--teal)', textDecoration: 'none' }}>
          PEP NATION LAB
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <a href="/products" style={{ fontSize: '0.8rem', color: 'var(--teal)', textDecoration: 'none', fontWeight: 600 }}>🔬 Browse Catalog</a>
          <span style={{ fontSize: '0.85rem', color: 'var(--silver)' }}>{name}</span>
          <span className="badge badge-silver" style={{ fontSize: '0.7rem' }}>Researcher</span>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" style={{ fontSize: '0.8rem', color: 'var(--grey-400)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Sign Out
            </button>
          </form>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-8)' }}>
        {/* Welcome banner */}
        {isWelcome && (
          <div style={{
            background: 'rgba(0,196,188,0.08)',
            border: '1px solid rgba(0,196,188,0.25)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4) var(--space-6)',
            marginBottom: 'var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)'
          }}>
            <span style={{ fontSize: '1.2rem' }}>🎉</span>
            <div>
              <strong style={{ color: 'var(--teal)' }}>Welcome To Pep Nation Lab!</strong>
              <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', margin: 0 }}>Your Researcher Account Is Active. Browse Our Catalog And Place Your First Order.</p>
            </div>
          </div>
        )}

        {/* Page title */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: 4 }}>
            Welcome Back, <span style={{ color: 'var(--teal)' }}>{name}</span>
          </h1>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', margin: 0 }}>
            Researcher Dashboard — Research Use Only
          </p>
        </div>

        <ResearcherDashboard
          userId={user.id}
          userName={name}
          userEmail={user.email || ''}
          agentId={agentId}
          agentName={agentName}
          profile={{
            full_name: profile?.full_name ?? null,
            role: role,
            tier: profile?.tier ?? null,
            prepaid_balance: profile?.prepaid_balance ?? 0,
            credit_limit: profile?.credit_limit ?? 0,
            account_type: profile?.account_type ?? null,
            disclaimer_v1_accepted: profile?.disclaimer_v1_accepted ?? false,
            phone: profile?.phone ?? null,
          }}
        />
      </div>
    </div>
  );
}
