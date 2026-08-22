export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/Navbar';
import TrafficDashboard from '@/components/TrafficDashboard';

export const metadata = { title: 'Storefront Traffic', robots: { index: false, follow: false } };

export default async function AgentTrafficPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/dashboard/agent/traffic');
  const { data: profile } = await supabase
    .from('profiles').select('role, is_super_agent, is_sub_agent').eq('id', user.id).maybeSingle();
  const isAgentTier = !!profile && (profile.role === 'agent' || profile.role === 'super_agent'
    || profile.is_super_agent === true || profile.is_sub_agent === true || profile.role === 'admin');
  if (!isAgentTier) redirect('/dashboard');

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)' }}>
      <Navbar title="Storefront Traffic" />
      <div className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-12)', maxWidth: 1100 }}>
        <TrafficDashboard
          endpoint="/api/agent/traffic"
          heading="Storefront Traffic"
          subheading="Visitors, funnel, and engagement on your storefront."
        />
      </div>
    </div>
  );
}
