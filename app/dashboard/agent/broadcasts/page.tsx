import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AgentBroadcast from '@/components/AgentBroadcast';
import Navbar from '@/components/Navbar';
import BackButton from '@/components/ui/BackButton';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Broadcast To Researchers',
};

// Broadcast is an admin-only feature.
export default async function AgentBroadcastPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
      <Navbar />
      <AgentBroadcast />
    </div>
  );
}
