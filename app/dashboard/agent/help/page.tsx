import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import Navbar from '@/components/Navbar';
import HelpContent from './HelpContent';

export const dynamic = 'force-dynamic';

export default async function AgentHelpPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/dashboard/agent/help');

  const svc = await createServiceClient();
  const { data: prof } = await svc
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!prof || prof.is_active === false) redirect('/login?redirect=/dashboard/agent/help');
  if (!['agent', 'super_agent', 'admin'].includes(prof.role)) redirect('/dashboard');

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 'var(--nav-offset, 60px)', minHeight: '100dvh', background: 'var(--black)' }}>
        <HelpContent />
      </main>
    </>
  );
}
