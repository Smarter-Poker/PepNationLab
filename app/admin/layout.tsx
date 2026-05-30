import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminLayoutClient } from './AdminLayoutClient';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'shipping') {
    redirect('/shipping');
  }

  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <AdminLayoutClient adminName={profile?.full_name || 'Admin'}>
      {children}
    </AdminLayoutClient>
  );
}
