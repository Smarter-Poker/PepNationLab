import { redirect } from 'next/navigation';
import { isEffectiveAdmin } from '@/lib/platform-admins';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import AdminSearchClient from './AdminSearchClient';

export const dynamic = 'force-dynamic';

export default async function AdminSearchPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/admin/search');

  const svc = await createServiceClient();
  const { data: prof } = await svc
    .from('profiles')
    .select('role, is_active, is_admin_account')
    .eq('id', user.id)
    .maybeSingle();
  if (!prof || prof.is_active === false) redirect('/login');
  if (!isEffectiveAdmin(user.id, prof.role) && prof?.is_admin_account !== true) redirect('/dashboard');

  return <AdminSearchClient />;
}
