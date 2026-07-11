import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AgentBroadcast from '@/components/AgentBroadcast';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Broadcast To Researchers',
};

// Any agent, super-agent or admin can broadcast to their own downline.
export default async function AgentBroadcastPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const allowed = profile?.role === 'agent' || profile?.role === 'super_agent' || profile?.role === 'admin';
  if (!allowed) redirect('/dashboard');

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
      <AgentBroadcast />
    </div>
  );
}
