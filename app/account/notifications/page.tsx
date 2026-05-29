import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import NotificationsClient from './NotificationsClient';

export const dynamic = 'force-dynamic';

interface RowPrefs {
  sms_enabled: boolean;
  sms_phone: string | null;
  sms_phone_verified: boolean;
  events_order_approved: boolean;
  events_order_shipped: boolean;
  events_order_delivered: boolean;
  events_payment_reminder: boolean;
  push_enabled: boolean;
  push_events_order: boolean;
  push_events_messages: boolean;
  push_events_marketing: boolean;
}

const DEFAULT_PREFS: RowPrefs = {
  sms_enabled: false,
  sms_phone: null,
  sms_phone_verified: false,
  events_order_approved: true,
  events_order_shipped: true,
  events_order_delivered: true,
  events_payment_reminder: true,
  push_enabled: false,
  push_events_order: true,
  push_events_messages: true,
  push_events_marketing: false,
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: row } = await supabase
    .from('notification_preferences')
    .select('sms_enabled, sms_phone, sms_phone_verified, events_order_approved, events_order_shipped, events_order_delivered, events_payment_reminder, push_enabled, push_events_order, push_events_messages, push_events_marketing')
    .eq('user_id', user.id)
    .maybeSingle();

  const prefs: RowPrefs = row
    ? {
        sms_enabled: !!row.sms_enabled,
        sms_phone: row.sms_phone ?? null,
        sms_phone_verified: !!row.sms_phone_verified,
        events_order_approved: row.events_order_approved !== false,
        events_order_shipped: row.events_order_shipped !== false,
        events_order_delivered: row.events_order_delivered !== false,
        events_payment_reminder: row.events_payment_reminder !== false,
        push_enabled: !!row.push_enabled,
        push_events_order: row.push_events_order !== false,
        push_events_messages: row.push_events_messages !== false,
        push_events_marketing: !!row.push_events_marketing,
      }
    : DEFAULT_PREFS;

  return <NotificationsClient initialPrefs={prefs} userEmail={user.email ?? ''} />;
}
