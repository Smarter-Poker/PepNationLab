import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AgentInvitations from '@/components/AgentInvitations';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Invite Agents',
};

// Recruiting surface for super-agents and admins. Regular agents cannot mint
// invitations (matches the agent_invitations RLS), so they are redirected.
export default async function AgentInvitationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_super_agent')
    .eq('id', user.id)
    .maybeSingle();

  const isAdmin = profile?.role === 'admin';
  const isSuperAgent = profile?.role === 'super_agent' || profile?.is_super_agent === true;

  if (!isAdmin && !isSuperAgent) {
    redirect('/dashboard');
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
      <AgentInvitations canInviteSuperAgents={isAdmin} />
    </div>
  );
}
