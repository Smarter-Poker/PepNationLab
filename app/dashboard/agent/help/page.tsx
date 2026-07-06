import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/Navbar';
import HelpContent from './HelpContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Help | Agent Dashboard | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default async function AgentHelpPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/dashboard/agent/help');

  // Use the user's own auth session (createClient) rather than service role
  // for reading the current user's own profile -- no admin privileges needed.
  const { data: prof } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  // Only block explicitly deactivated users; null (newly created) is allowed
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
