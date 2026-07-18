import type { Metadata } from 'next';
import { isEffectiveAdmin } from '@/lib/platform-admins';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import AdminMessengerClient from './AdminMessengerClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Message Moderation | Admin | Pep Nation Lab',
  robots: { index: false, follow: true },
};

export default async function AdminModerationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/admin/moderation');

  const service = await createServiceClient();
  const { data: me } = await service
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();
  if (!isEffectiveAdmin(user.id, me?.role) || me?.is_active === false) redirect('/dashboard');

  return <AdminMessengerClient />;
}
