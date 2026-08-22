export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isEffectiveAdmin } from '@/lib/platform-admins';
import TrafficDashboard from '@/components/TrafficDashboard';

export const metadata = { title: 'Site Traffic', robots: { index: false, follow: false } };

export default async function AdminTrafficPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role, is_admin_account').eq('id', user.id).maybeSingle();
  if (!isEffectiveAdmin(user.id, profile?.role) && profile?.is_admin_account !== true) redirect('/dashboard');

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
      <TrafficDashboard
        endpoint="/api/admin/traffic"
        heading="Site Traffic"
        subheading="Visitors, funnel, and engagement across every storefront."
      />
    </div>
  );
}
