import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import HelpSupportClient from '@/components/account/HelpSupportClient';

export const dynamic = 'force-dynamic';

// /account/help
// Help & Support: FAQ plus a Contact Support action that opens the user's live
// support thread with admin via the shared messenger channel
// (POST /api/messenger/support/open), which the admin Customer Support inbox monitors.
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
