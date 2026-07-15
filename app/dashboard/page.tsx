import { redirect } from 'next/navigation';
import { createClient, getCachedUser } from '@/lib/supabase/server';
import Navbar from '@/components/Navbar';
import ResearcherDashboard from '@/components/ResearcherDashboard';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const supabase = await createClient();
  // Deduped per-request with the dashboard layout's auth check - getUser()
  // is a network call to Supabase Auth.
  const { user } = await getCachedUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, tier, prepaid_balance, credit_limit, account_type, disclaimer_v1_accepted, phone, referring_agent_id, username, is_sub_agent, is_super_agent, is_manufacturer, onboarding_completed_at')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role ?? 'researcher';

  // Role-based routing
  if (role === 'admin') redirect('/admin');
  if (role === 'shipping') redirect('/shipping');

  // Manufacturer accounts (is_manufacturer = true) intentionally flow through
  // the SAME routing as agents/super agents below - full feature parity per
  // owner request 2026-07-15. Their pricing/ledger differences live in DB
  // triggers; the legacy /dashboard/manufacturer page stays reachable by URL.

  // Onboarding gate: new + promoted agent-type accounts must finish the guided
  // setup wizard before reaching any dashboard. Admins/shipping above are
  // exempt; researchers (handled below) are never gated.
  // See migration 20260608000050 + /onboarding.
  {
    const isSubAgent = (profile as { is_sub_agent?: boolean | null })?.is_sub_agent === true;
    const isAgentType =
      isSubAgent || role === 'agent' || role === 'super_agent' ||
      (profile as { is_super_agent?: boolean | null })?.is_super_agent === true;
    if (isAgentType && !(profile as { onboarding_completed_at?: string | null })?.onboarding_completed_at) {
      redirect('/onboarding');
    }
  }
  // SACA: sub-agents have role='agent' + is_sub_agent=true. They get their
  // own dashboard at /dashboard/sub-agent - NEVER the full agent dashboard,
  // which would expose storefront config they don't own and order management
  // they can't action. Check before the agent/super_agent redirect below.
  if ((profile as { is_sub_agent?: boolean | null })?.is_sub_agent === true) {
    redirect('/dashboard/sub-agent');
  }
  if (role === 'agent' || role === 'super_agent') redirect('/dashboard/agent');

  const params = await searchParams;
  const isWelcome = params?.welcome === '1';
  const name = profile?.full_name ?? profile?.username ?? user.email?.split('@')[0] ?? 'Researcher';

  // Get referring agent info
  const agentId: string | null = profile?.referring_agent_id ?? null;
  let agentSlug: string | null = null;
  let agentName: string | null = null;
  if (agentId) {
    const { data: agent } = await supabase
      .from('agent_profiles')
      .select('display_name, slug')
      .eq('id', agentId)
      .maybeSingle();
    agentName = agent?.display_name ?? null;
    agentSlug = agent?.slug ?? null;
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)' }}>
      <Navbar />
      {/* 60px spacer for fixed navbar */}
      <div style={{ height: 60 }} />

      <div>
        {/* Welcome banner */}
        {isWelcome && (
          <div className="container" style={{ paddingTop: 'var(--space-6)' }}>
            <div style={{
              background: 'rgba(0,196,188,0.06)',
              border: '1px solid rgba(0,196,188,0.2)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4) var(--space-6)',
              marginBottom: 'var(--space-6)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <div>
                <strong style={{ color: 'var(--teal)' }}>Welcome To Pep Nation Lab!</strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', margin: 0 }}>Your Researcher Account Is Active. Browse Our Catalog And Place Your First Order.</p>
              </div>
            </div>
          </div>
        )}

        <ResearcherDashboard
          userId={user.id}
          userName={name}
          userEmail={user.email || ''}
          agentId={agentId}
          agentName={agentName}
          agentSlug={agentSlug}
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
