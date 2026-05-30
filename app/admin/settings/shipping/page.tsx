import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminShippingSettingsClient from './AdminShippingSettingsClient';

export const metadata: Metadata = {
  title: 'Shipping Settings — Admin — Pep Nation Lab',
  description: 'Manage Shippo platform connection, warehouse origins, and shipping configuration.',
  robots: { index: false, follow: false },
};

export default async function AdminShippingSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <AdminShippingSettingsClient />;
}
