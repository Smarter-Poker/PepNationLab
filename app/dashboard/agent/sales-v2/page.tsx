import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SalesPageV2 from '@/components/sales/SalesPageV2';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Sales Performance | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default async function SalesV2Route() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || !['agent', 'super_agent', 'admin'].includes(profile?.role)) redirect('/dashboard');
  return <SalesPageV2 />;
}
