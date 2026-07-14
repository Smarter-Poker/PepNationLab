export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createClient, getCachedUser } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import EmailCenterClient from './EmailCenterClient';

export const metadata = {
  title: 'Email Center | Admin — Pep Nation Lab',
  robots: { index: false },
};

export default async function EmailCenterPage() {
  const supabase = await createClient();
  const { user } = await getCachedUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') redirect('/dashboard');

  return <EmailCenterClient />;
}
