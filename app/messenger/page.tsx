import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import MessengerShell from '@/components/messenger/MessengerShell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Messenger | Pep Nation Lab',
  description: 'Direct Messaging Across Pep Nation Lab.',
  robots: { index: false, follow: false },
};

export default async function MessengerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/messenger');

  // Audit10: block deactivated users at page mount, not just inside the API.
  // requireSession enforces this at the route layer; mirror it here so the
  // shell does not hydrate for a banned/deactivated account.
  const svc = await createServiceClient();
  const { data: prof } = await svc
    .from('profiles')
    .select('is_active')
    .eq('id', user.id)
    .maybeSingle();
  if (prof && prof.is_active === false) redirect('/login?redirect=/messenger');

  return <MessengerShell userId={user.id} />;
}
