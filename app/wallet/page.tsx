// Round 24 Wallet - /wallet shell
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import WalletPage from '@/components/wallet/WalletPage';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Wallet | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default async function WalletRoute() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, account_type, is_super_agent')
    .eq('id', user.id)
    .single();
  if (!profile) redirect('/login');
  // Every signed-in role can reach /wallet. Empty data states are handled
  // gracefully by each tab's "No ... Yet" copy when the underlying scope
  // returns nothing.
  const allowed = ['researcher', 'agent', 'super_agent', 'admin'].includes(profile.role);
  if (!allowed) redirect('/dashboard');
  return <WalletPage userId={user.id} role={profile.role} isSuperAgent={!!profile.is_super_agent} />;
}
