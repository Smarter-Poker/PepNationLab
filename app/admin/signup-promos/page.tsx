import { redirect } from 'next/navigation';
import { isEffectiveAdmin } from '@/lib/platform-admins';
import { createClient } from '@/lib/supabase/server';
import SignupPromoManager from '@/components/SignupPromoManager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Signup Promo Codes', robots: { index: false, follow: false } };

export default async function AdminSignupPromosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role, is_admin_account').eq('id', user.id).maybeSingle();
  if (!isEffectiveAdmin(user.id, profile?.role) && profile?.is_admin_account !== true) redirect('/dashboard');

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
      <SignupPromoManager endpoint="/api/admin/signup-promos" heading="Signup Promo Codes" />
    </div>
  );
}
