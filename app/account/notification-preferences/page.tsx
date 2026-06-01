import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import NotificationPreferencesClient from './NotificationPreferencesClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Notification Preferences | Pep Nation Lab',
};

export default async function NotificationPreferencesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('push_enabled, push_type_prefs')
    .eq('user_id', user.id)
    .maybeSingle();

  const initialMap =
    prefs?.push_type_prefs && typeof prefs.push_type_prefs === 'object'
      ? (prefs.push_type_prefs as Record<string, boolean>)
      : {};

  return (
    <NotificationPreferencesClient
      initialPushEnabled={!!prefs?.push_enabled}
      initialMap={initialMap}
    />
  );
}
