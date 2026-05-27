import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminAgents from '@/components/AdminAgents';

export const metadata = {
  title: 'Agents Management | Admin | Pep Nation Lab',
};

export default async function AdminAgentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    redirect('/');
  }

  return <AdminAgents />;
}
