import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AgentReferralsClient from './AgentReferralsClient';
import Navbar from '@/components/Navbar';
import BackButton from '@/components/ui/BackButton';

export const dynamic = 'force-dynamic';

export default async function AgentReferralsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?redirect=/dashboard/agent/referrals');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) redirect('/login');

  const allowed = ['agent', 'super_agent', 'admin'];
  if (!allowed.includes(profile.role)) {
    redirect('/dashboard');
  }

  // Fetch agent slug for the referral link
  const { data: agentProfileData } = await supabase
    .from('agent_profiles')
    .select('slug')
    .eq('id', user.id)
    .maybeSingle();

  const slug = agentProfileData?.slug ?? null;

  return <AgentReferralsClient agentSlug={slug} />;
}
