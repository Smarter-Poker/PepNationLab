import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import OnboardingWizard from '@/components/OnboardingWizard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Welcome To Pep Nation' };

/**
 * /onboarding -- the role-tailored guided setup wizard for super agents,
 * agents, and sub-agents. New + promoted accounts land here (their
 * onboarding_completed_at is NULL) and are hard-gated until they finish.
 *
 * Researchers, admins, and already-onboarded accounts are bounced straight
 * to their normal destination so this page is never a dead end.
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/onboarding');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_super_agent, is_sub_agent, onboarding_completed_at')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) redirect('/login');

  const isSub = (profile as { is_sub_agent?: boolean | null }).is_sub_agent === true;
  const isAgentType =
    isSub || profile.role === 'agent' || profile.role === 'super_agent' || (profile as { is_super_agent?: boolean | null }).is_super_agent === true;

  // Only agent-type accounts get the wizard. Everyone else goes home.
  if (!isAgentType) {
    redirect(profile.role === 'admin' ? '/admin' : '/dashboard');
  }

  // Already finished -> never show the wizard again.
  if ((profile as { onboarding_completed_at?: string | null }).onboarding_completed_at) {
    redirect(isSub ? '/dashboard/sub-agent' : '/dashboard/agent');
  }

  return <OnboardingWizard />;
}
