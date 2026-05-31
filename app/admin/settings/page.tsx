import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminSettingsClient from './AdminSettingsClient';

export const metadata = {
  title: 'Account Settings | Pep Nation Lab Admin',
};

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, avatar_url')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <AdminSettingsClient 
      profile={{
        id: profile.id,
        full_name: profile.full_name,
        email: user.email ?? '',
        avatar_url: profile.avatar_url,
      }}
    />
  );
}
