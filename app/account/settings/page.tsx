import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AccountClient, { type AccountProfile } from '@/components/account/AccountClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Account Settings | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, full_name, first_name, last_name, email, username, role, phone, timezone, ' +
      'avatar_url, username_changed_at, phone_verified_at, ' +
      'deactivated_at, is_active, disclaimer_v1_accepted, disclaimer_accepted_at',
    )
    .eq('id', user.id)
    .maybeSingle();

  let agentProfile = null;
  if ((profile as any)?.role && ['super_agent', 'agent', 'sub_agent'].includes((profile as any).role)) {
    const { data } = await supabase
      .from('agent_profiles')
      .select('slug, warehouse_address, payment_handles, is_active')
      .eq('id', user.id)
      .maybeSingle();
    agentProfile = data;
  }

  return (
    <AccountClient
      userId={user.id}
      initialProfile={(profile as unknown as AccountProfile) ?? null}
      initialAgentProfile={agentProfile}
      userEmail={user.email ?? ''}
      basePath="/account/settings"
    />
  );
}
