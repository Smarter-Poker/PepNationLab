import type { Metadata } from 'next';
import { isEffectiveAdmin } from '@/lib/platform-admins';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminShippingSettingsClient from './AdminShippingSettingsClient';

export const metadata: Metadata = {
  title: 'Shipping Settings - Admin - Pep Nation Lab',
  description: 'Manage EasyPost platform connection, warehouse origins, and shipping configuration.',
  robots: { index: false, follow: true },
};

export default async function AdminShippingSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (!isEffectiveAdmin(user.id, profile?.role)) redirect('/dashboard');

  return <AdminShippingSettingsClient />;
}
