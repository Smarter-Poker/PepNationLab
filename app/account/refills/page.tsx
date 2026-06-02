import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import RefillsClient from '@/components/account/RefillsClient';

export const dynamic = 'force-dynamic';

// /account/refills
// Refill + one-tap reorder hub for researchers. Data + reorder logic come from
// the existing /api/researcher/orders and /api/researcher/orders/[id]/reorder.
export default async function AccountRefillsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <RefillsClient />;
}

export const metadata = {
  title: 'Refills & Reorders | Pep Nation Lab',
  robots: { index: false, follow: false },
};
