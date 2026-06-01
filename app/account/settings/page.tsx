import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AccountClient from '@/components/account/AccountClient';

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
      'id, full_name, email, username, role, phone, timezone, locale, bio, ' +
      'pronouns, avatar_url, username_changed_at, phone_verified_at, ' +
      'deactivated_at, is_active, disclaimer_v1_accepted, disclaimer_accepted_at',
    )
    .eq('id', user.id)
    .maybeSingle();

  return (
    <AccountClient
      userId={user.id}
      initialProfile={profile ?? null}
      userEmail={user.email ?? ''}
      basePath="/account/settings"
    />
  );
}
