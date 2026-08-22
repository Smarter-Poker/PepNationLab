import { createClient } from '@/lib/supabase/server';
import { isEffectiveAdmin } from '@/lib/platform-admins';
import { redirect } from 'next/navigation';
import AdminAgents from '@/components/AdminAgents';

export const dynamic = 'force-dynamic';

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
    .select('role, is_admin_account')
    .eq('id', user.id)
    .maybeSingle();

  if (!isEffectiveAdmin(user.id, profile?.role) && profile?.is_admin_account !== true) {
    redirect('/dashboard');
  }

  return <AdminAgents />;
}
