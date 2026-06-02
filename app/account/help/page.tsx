import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import HelpSupportClient from '@/components/account/HelpSupportClient';

export const dynamic = 'force-dynamic';

// /account/help
// Help & Support: FAQ, a support-request form, and the user's ticket history.
// Tickets persist via /api/account/support into public.support_requests.
export default async function AccountHelpPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <HelpSupportClient />;
}

export const metadata = {
  title: 'Help & Support | Pep Nation Lab',
  robots: { index: false, follow: false },
};
