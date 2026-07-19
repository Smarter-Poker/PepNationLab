import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LanguageProvider } from '@/lib/i18n';
import ManufacturerDashboardClient from './ManufacturerDashboardClient';
import Navbar from '@/components/Navbar';

export const dynamic = 'force-dynamic';

/**
 * Manufacturer dashboard -- the factory's own control panel. Fully
 * trilingual (EN / Simplified / Traditional Chinese): pricing with zero
 * restrictions, order fulfillment, and the 90/10 commission ledger.
 */
export default async function ManufacturerDashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?redirect=/dashboard/manufacturer');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, is_manufacturer, is_admin_account, is_active, locale')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !profile.is_manufacturer || profile.is_active === false) {
    redirect('/dashboard');
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#050A0F' }}>
      <Navbar />
      {/* Spacer for the fixed navbar */}
      <div style={{ height: 'var(--nav-offset, 60px)' }} />
      <LanguageProvider initialLocale={profile.locale as string | null} syncToProfile>
        <ManufacturerDashboardClient />
      </LanguageProvider>
    </div>
  );
}
