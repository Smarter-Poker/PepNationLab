import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { enqueuePush } from '@/lib/push-enqueue';
import { sendWebPush, isWebPushConfigured } from '@/lib/web-push';

export const dynamic = 'force-dynamic';

/**
 * Send a test web-push to the current user (self-test) or, when the caller is
 * an admin, to an arbitrary user_id. Returns the outbox id + delivery summary.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = await createServiceClient();
  const { data: callerProfile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const isAdmin = callerProfile?.role === 'admin';

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON Body.' }, { status: 400 });
  }

  // Resolve target user. Non-admins are forced to self.
  let targetId = user.id;
  let event: 'admin_test' | 'self_test' = 'self_test';
  if (isAdmin && typeof body.user_id === 'string' && body.user_id.trim() !== '') {
    targetId = body.user_id.trim();
    event = 'admin_test';
  }

  const title =
    typeof body.title === 'string' && body.title.trim() !== ''
      ? body.title.trim().slice(0, 120)
      : 'Test Push Notification';
  const text =
    typeof body.body === 'string' && body.body.trim() !== ''
      ? body.body.trim().slice(0, 500)
      : 'This Is A Test From Pep Nation Lab.';
  const url =
    typeof body.url === 'string' && body.url.trim() !== ''
      ? body.url.trim().slice(0, 500)
      : '/account/notifications';

  // Enqueue (also honours the user's opt-out flags).
  const outboxId = await enqueuePush(service, {
    userId: targetId,
    title,
    body: text,
    url,
    event,
    tag: `test-${Date.now()}`,
  });

  if (!outboxId) {
    return NextResponse.json(
      { ok: false, error: 'Push Notifications Are Not Enabled For This User.' },
      { status: 409 }
    );
  }

  if (!isWebPushConfigured()) {
    await service
      .from('push_outbox')
      .update({
        status: 'skipped',
        failure_reason: 'web_push_not_configured',
        sent_at: new Date().toISOString(),
      })
      .eq('id', outboxId);

    if (isAdmin && event === 'admin_test') {
      await service.from('admin_audit_log').insert({
        actor_id: user.id,
        action: 'admin_push_test',
        entity_type: 'user',
        entity_id: targetId,
        changes: { outboxId, status: 'skipped', reason: 'web_push_not_configured' },
      });
    }

    return NextResponse.json({
      ok: false,
      outboxId,
      sent: 0,
      failed: 0,
      skipped: true,
      reason: 'web_push_not_configured',
    });
  }

  // Drain that one row immediately against the user's active subscriptions.
  const { data: subs } = await service
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, failure_count')
    .eq('user_id', targetId)
    .eq('is_active', true);

  let sent = 0;
  let failed = 0;
  let expiredCount = 0;
  let lastError: string | null = null;

  for (const s of subs ?? []) {
    const result = await sendWebPush(
      { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
      { title, body: text, url, tag: `test-${Date.now()}` }
    );
    if (result.ok) {
      sent++;
      await service
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString(), failure_count: 0, last_failure_reason: null })
        .eq('id', s.id);
    } else {
      failed++;
      lastError = result.error ?? lastError;
      if (result.expired) {
        expiredCount++;
        await service
          .from('push_subscriptions')
          .update({ is_active: false, last_failure_reason: result.error ?? null })
          .eq('id', s.id);
      } else {
        await service
          .from('push_subscriptions')
          .update({
            failure_count: (Number(s.failure_count) || 0) + 1,
            last_failure_reason: result.error ?? null,
          })
          .eq('id', s.id);
      }
    }
  }

  await service
    .from('push_outbox')
    .update({
      status: sent > 0 ? 'sent' : 'failed',
      attempts: 1,
      sent_at: new Date().toISOString(),
      failure_reason: sent > 0 ? null : lastError,
    })
    .eq('id', outboxId);

  if (isAdmin && event === 'admin_test') {
    await service.from('admin_audit_log').insert({
      actor_id: user.id,
      action: 'admin_push_test',
      entity_type: 'user',
      entity_id: targetId,
      changes: { outboxId, sent, failed, expiredCount },
    });
  }

  return NextResponse.json({
    ok: sent > 0,
    outboxId,
    sent,
    failed,
    expiredCount,
    subscriptionsTried: (subs ?? []).length,
  });
}
