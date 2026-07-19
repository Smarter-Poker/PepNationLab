import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import NetworkDashboardClient from './NetworkDashboardClient';
import Navbar from '@/components/Navbar';

export const dynamic = 'force-dynamic';

/**
 * Admin-account command center. Dedicated dashboard for is_admin_account
 * accounts (super-agent admins, e.g. Savage Brands) -- separate from the
 * manufacturer dashboard. Manufacturers land on /dashboard/manufacturer;
 * everyone else on /dashboard.
 */
export default async function NetworkDashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?redirect=/dashboard/network');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin_account, is_manufacturer, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false) {
    redirect('/dashboard');
  }
  // Manufacturers keep their own dashboard; only admin accounts land here.
  if (profile.is_admin_account !== true) {
    redirect(profile.is_manufacturer === true ? '/dashboard/manufacturer' : '/dashboard');
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#050A0F' }}>
      <Navbar />
      {/* Spacer for the fixed navbar */}
      <div style={{ height: 'var(--nav-offset, 60px)' }} />
      <NetworkDashboardClient />
    </div>
  );
}
