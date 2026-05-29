import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import AdminMessengerClient from './AdminMessengerClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Messenger Moderation | Admin | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default async function AdminMessengerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/admin/messenger');

  const service = await createServiceClient();
  const { data: me } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (me?.role !== 'admin') redirect('/dashboard');

  return <AdminMessengerClient />;
}
