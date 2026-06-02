import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProfilePageClient from '@/components/account/ProfilePageClient';
import type { AccountProfile } from '@/components/account/AccountClient';

export const dynamic = 'force-dynamic';

// /account/profile
// Dedicated full profile editor. Reuses the AccountOverview component so the
// hub's "Profile" row and the /account/settings overview tab stay in sync.
export default async function AccountProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('profiles')
    .select(
      'id, first_name, last_name, full_name, email, username, role, phone, timezone, locale, bio, pronouns, ' +
      'avatar_url, username_changed_at, phone_verified_at, deactivated_at, is_active, ' +
      'disclaimer_v1_accepted, disclaimer_accepted_at',
    )
    .eq('id', user.id)
    .maybeSingle();

  return (
    <ProfilePageClient
      userId={user.id}
      userEmail={user.email ?? ''}
      initialProfile={(data as AccountProfile | null) ?? null}
    />
  );
}

export const metadata = {
  title: 'Profile | Pep Nation Lab',
  robots: { index: false, follow: false },
};
