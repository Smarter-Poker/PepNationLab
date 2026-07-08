import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ReferralsClient from './ReferralsClient';

export const dynamic = 'force-dynamic';

export default async function ReferralsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch referral code (lazily creates one via RPC)
  let referralCode: string | null = null;
  try {
    const { data } = await supabase.rpc('get_or_create_referral_code', { p_user_id: user.id });
    referralCode = data as string | null;
  } catch {
    // RPC may not be available; fall back gracefully
  }

  // Fetch existing referrals
  const { data: referrals } = await supabase
    .from('researcher_referrals')
    .select('id, status, referee_email, applied_at, rewarded_at, referrer_reward_amount, referee_reward_amount, created_at')
    .eq('referrer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  // Fetch referral settings
  const { data: settings } = await supabase
    .from('referral_settings')
    .select('referrer_reward, referee_reward, min_order_total, is_active')
    .eq('id', 1)
    .maybeSingle();

  return (
    <ReferralsClient
      referralCode={referralCode}
      referrals={referrals ?? []}
      settings={settings ?? { referrer_reward: 25, referee_reward: 25, min_order_total: 100, is_active: true }}
    />
  );
}

export const metadata = {
  title: 'Referrals | Pep Nation Lab',
  robots: { index: false, follow: true },
};
