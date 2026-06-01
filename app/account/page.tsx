import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AccountClient from '@/components/account/AccountClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Your Account | Pep Nation Lab',
  robots: { index: false, follow: false },
};

/**
 * Account self-serve surface.
 *
 * Server component does the auth gate, hydrates the initial profile and
 * agent_profiles snapshot, then hands off to AccountClient which renders
 * the Overview / Security / Notifications / Compliance / Danger Zone tabs.
 *
 * The legacy sub-routes (/account/security, /account/notifications, etc.)
 * still exist — those are link targets from external pages and remain a
 * valid way in. This page is the unified self-serve hub.
 */
export default async function AccountPage() {
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
    />
  );
}
