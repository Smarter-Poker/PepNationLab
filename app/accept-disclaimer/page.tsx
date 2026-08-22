import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AcceptDisclaimerClient from '@/components/AcceptDisclaimerClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Mandatory Research-Only acknowledgment gate. proxy.ts redirects any
 * authenticated user whose disclaimer_v1_accepted is not true here. Already-
 * accepted users are sent straight to their destination.
 */
export default async function AcceptDisclaimerPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('disclaimer_v1_accepted')
    .eq('id', user.id)
    .maybeSingle();

  const sp = await searchParams;
  const raw = sp?.redirect;
  const dest =
    typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';

  if (profile?.disclaimer_v1_accepted === true) redirect(dest);

  return <AcceptDisclaimerClient redirectTo={dest} />;
}
