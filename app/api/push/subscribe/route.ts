import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

interface IncomingSub {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown } | unknown;
  userAgent?: unknown;
  deviceLabel?: unknown;
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: IncomingSub = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON Body.' }, { status: 400 });
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
  const keys =
    body.keys && typeof body.keys === 'object'
      ? (body.keys as { p256dh?: unknown; auth?: unknown })
      : {};
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh : '';
  const auth = typeof keys.auth === 'string' ? keys.auth : '';
  const userAgent = typeof body.userAgent === 'string' ? body.userAgent.slice(0, 500) : null;
  const deviceLabel = typeof body.deviceLabel === 'string' ? body.deviceLabel.slice(0, 120) : null;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Missing Subscription Fields.' }, { status: 422 });
  }

  // Use service client to upsert and reactivate dead rows.
  const service = await createServiceClient();
  const { data, error } = await service
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent,
        device_label: deviceLabel,
        is_active: true,
        failure_count: 0,
        last_failure_reason: null,
      },
      { onConflict: 'user_id,endpoint' }
    )
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || 'Save Failed.' },
      { status: 500 }
    );
  }

  // One account per device. A physical push endpoint can only belong to whoever
  // is signed in on that device right now. If this same endpoint was previously
  // registered to a DIFFERENT user (e.g. the device was switched from one
  // account to another), deactivate those stale rows so calls/messages meant for
  // the old account never ring this device — which otherwise looks like the two
  // accounts are "linked".
  await service
    .from('push_subscriptions')
    .update({ is_active: false, last_failure_reason: 'reassigned_to_other_user' })
    .eq('endpoint', endpoint)
    .neq('user_id', user.id)
    .then(() => undefined, () => undefined);

  // Auto-flip push_enabled = true so the user does not have to also save the prefs page.
  await service
    .from('notification_preferences')
    .upsert(
      { user_id: user.id, push_enabled: true, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { endpoint?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON Body.' }, { status: 400 });
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
  if (!endpoint) {
    return NextResponse.json({ error: 'Missing Endpoint.' }, { status: 422 });
  }

  const service = await createServiceClient();
  const { error } = await service
    .from('push_subscriptions')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .eq('endpoint', endpoint);

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
