import { redirect } from 'next/navigation';
import { isEffectiveAdmin } from '@/lib/platform-admins';
import { createClient } from '@/lib/supabase/server';
import AdminReferralPromotions from '@/components/AdminReferralPromotions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Referral Promotions',
};

export default async function ReferralPromotionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin_account')
    .eq('id', user.id)
    .maybeSingle();

  if (!isEffectiveAdmin(user.id, profile?.role) && profile?.is_admin_account !== true) redirect('/dashboard');

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
      <AdminReferralPromotions />
    </div>
  );
}
