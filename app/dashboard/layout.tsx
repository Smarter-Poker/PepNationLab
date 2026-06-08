import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Dashboard hard-gate.
 *
 * Wraps every /dashboard/* route. New + promoted agent-type accounts
 * (super agent / agent / sub-agent) whose onboarding_completed_at is still
 * NULL are redirected to the guided setup wizard and cannot reach any
 * dashboard surface -- including the client-rendered sub-agent dashboard and
 * deep-linked sub-pages -- until they finish.
 *
 * Researchers are never gated (they are not agent-type). Admins and shipping
 * live outside /dashboard entirely. /onboarding is outside this tree, so there
 * is no redirect loop. See migration 20260608000050.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_sub_agent, is_super_agent, onboarding_completed_at')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      const isSubAgent = (profile as { is_sub_agent?: boolean | null }).is_sub_agent === true;
      const isAgentType =
        isSubAgent ||
        profile.role === 'agent' ||
        profile.role === 'super_agent' ||
        (profile as { is_super_agent?: boolean | null }).is_super_agent === true;

      if (isAgentType && !(profile as { onboarding_completed_at?: string | null }).onboarding_completed_at) {
        redirect('/onboarding');
      }
    }
  }

  return <>{children}</>;
}
