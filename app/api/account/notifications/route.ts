import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

const PHONE_RE = /^\+\d{10,15}$/;

const DEFAULT_PREFS = {
  sms_enabled: false,
  sms_phone: null as string | null,
  sms_phone_verified: false,
  events_order_approved: true,
  events_order_shipped: true,
  events_order_delivered: true,
  events_payment_reminder: true,
};

async function getCurrentUserPrefs(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('notification_preferences')
    .select('sms_enabled, sms_phone, sms_phone_verified, events_order_approved, events_order_shipped, events_order_delivered, events_payment_reminder, push_enabled, push_events_order, push_events_messages, push_events_marketing, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let prefs = await getCurrentUserPrefs(supabase, user.id);

  if (!prefs) {
    // Lazy-create the default row so the page always renders.
    await supabase
      .from('notification_preferences')
      .insert({ user_id: user.id, ...DEFAULT_PREFS });
    prefs = await getCurrentUserPrefs(supabase, user.id);
  }

  return NextResponse.json({
    preferences: prefs ?? { ...DEFAULT_PREFS, updated_at: null },
  });
}

export async function PATCH(req: NextRequest) {
  const csrfFail = assertSameOrigin(req);
  if (csrfFail) return csrfFail;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON Body.' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.sms_enabled === 'boolean') updates.sms_enabled = body.sms_enabled;
  if (typeof body.events_order_approved === 'boolean') updates.events_order_approved = body.events_order_approved;
  if (typeof body.events_order_shipped === 'boolean') updates.events_order_shipped = body.events_order_shipped;
  if (typeof body.events_order_delivered === 'boolean') updates.events_order_delivered = body.events_order_delivered;
  if (typeof body.events_payment_reminder === 'boolean') updates.events_payment_reminder = body.events_payment_reminder;
  if (typeof body.push_enabled === 'boolean') updates.push_enabled = body.push_enabled;
  if (typeof body.push_events_order === 'boolean') updates.push_events_order = body.push_events_order;
  if (typeof body.push_events_messages === 'boolean') updates.push_events_messages = body.push_events_messages;
  if (typeof body.push_events_marketing === 'boolean') updates.push_events_marketing = body.push_events_marketing;

  if (body.sms_phone === null || body.sms_phone === '') {
    updates.sms_phone = null;
    updates.sms_phone_verified = false;
  } else if (typeof body.sms_phone === 'string') {
    const phone = body.sms_phone.trim();
    if (!PHONE_RE.test(phone)) {
      return NextResponse.json(
        { error: 'Phone Number Must Be In E.164 Format (Example: +12025550100).' },
        { status: 422 }
      );
    }
    updates.sms_phone = phone;
    // Future: trigger Twilio Verify here; for now treat as verified-on-save.
    updates.sms_phone_verified = true;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No Valid Fields To Update.' }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const prefs = await getCurrentUserPrefs(supabase, user.id);
  return NextResponse.json({ preferences: prefs });
}
