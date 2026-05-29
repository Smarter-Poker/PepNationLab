import type { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { sendWebPush, isWebPushConfigured } from '@/lib/web-push';

export const dynamic = 'force-dynamic';

const BATCH_LIMIT = 100;
const MAX_ATTEMPTS = 5;

interface OutboxRow {
  id: string;
  recipient_user_id: string | null;
  title: string;
  body: string;
  url: string | null;
  tag: string | null;
  icon_url: string | null;
  badge_url: string | null;
  attempts: number;
}

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
}

function fivemPartitionKey(d: Date = new Date()): string {
  // YYYY-MM-DDTHH (hourly partition — cron fires every 5 min but we only
  // need one row per hour so concurrent invocations are skipped cleanly).
  return d.toISOString().slice(0, 13);
}

export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partitionKey = fivemPartitionKey();
  const claim = await claimCronRun('push_dispatch', partitionKey);
  if (!claim) {
    return Response.json({ skipped: true, reason: 'already_ran_this_hour' });
  }

  let processed = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let permanentlyFailed = 0;
  let deactivated = 0;
  let errorNote: string | null = null;

  try {
    const supabase = await createServiceClient();
    const pushOn = isWebPushConfigured();

    const { data: rows, error } = await supabase
      .from('push_outbox')
      .select('id, recipient_user_id, title, body, url, tag, icon_url, badge_url, attempts')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(BATCH_LIMIT);

    if (error) {
      errorNote = `select_failed: ${error.message}`.slice(0, 300);
    } else {
      for (const row of (rows ?? []) as OutboxRow[]) {
        processed++;

        if (!pushOn) {
          await supabase
            .from('push_outbox')
            .update({
              status: 'skipped',
              failure_reason: 'web_push_not_configured',
              sent_at: new Date().toISOString(),
            })
            .eq('id', row.id);
          skipped++;
          continue;
        }

        if (!row.recipient_user_id) {
          await supabase
            .from('push_outbox')
            .update({
              status: 'skipped',
              failure_reason: 'no_recipient',
              sent_at: new Date().toISOString(),
            })
            .eq('id', row.id);
          skipped++;
          continue;
        }

        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('id, endpoint, p256dh, auth, failure_count')
          .eq('user_id', row.recipient_user_id)
          .eq('is_active', true);

        if (!subs || subs.length === 0) {
          await supabase
            .from('push_outbox')
            .update({
              status: 'skipped',
              failure_reason: 'no_subscription',
              sent_at: new Date().toISOString(),
            })
            .eq('id', row.id);
          skipped++;
          continue;
        }

        let rowSent = 0;
        let lastError: string | null = null;

        for (const s of subs as SubRow[]) {
          const result = await sendWebPush(
            { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
            {
              title: row.title,
              body: row.body,
              url: row.url ?? '/',
              tag: row.tag ?? undefined,
              icon: row.icon_url ?? undefined,
              badge: row.badge_url ?? undefined,
            }
          );
          if (result.ok) {
            rowSent++;
            await supabase
              .from('push_subscriptions')
              .update({ last_used_at: new Date().toISOString(), failure_count: 0, last_failure_reason: null })
              .eq('id', s.id);
          } else {
            lastError = result.error ?? lastError;
            if (result.expired) {
              deactivated++;
              await supabase
                .from('push_subscriptions')
                .update({ is_active: false, last_failure_reason: result.error ?? null })
                .eq('id', s.id);
            } else {
              await supabase
                .from('push_subscriptions')
                .update({
                  failure_count: (Number(s.failure_count) || 0) + 1,
                  last_failure_reason: result.error ?? null,
                })
                .eq('id', s.id);
            }
          }
        }

        if (rowSent > 0) {
          await supabase
            .from('push_outbox')
            .update({
              status: 'sent',
              attempts: (row.attempts || 0) + 1,
              sent_at: new Date().toISOString(),
              failure_reason: null,
            })
            .eq('id', row.id);
          sent++;
        } else {
          const nextAttempts = (row.attempts || 0) + 1;
          if (nextAttempts >= MAX_ATTEMPTS) {
            await supabase
              .from('push_outbox')
              .update({
                status: 'failed',
                attempts: nextAttempts,
                sent_at: new Date().toISOString(),
                failure_reason: (lastError ?? 'all_subs_failed').slice(0, 300),
              })
              .eq('id', row.id);
            permanentlyFailed++;
          } else {
            await supabase
              .from('push_outbox')
              .update({
                attempts: nextAttempts,
                failure_reason: (lastError ?? 'all_subs_failed').slice(0, 300),
              })
              .eq('id', row.id);
          }
          failed++;
        }
      }
    }
  } catch (err: unknown) {
    errorNote = err instanceof Error ? err.message.slice(0, 300) : 'unknown_error';
  }

  const summary = `processed=${processed} sent=${sent} failed=${failed} skipped=${skipped} permanentlyFailed=${permanentlyFailed} deactivated=${deactivated}${errorNote ? ` err=${errorNote}` : ''}`;
  await finishCronRun(claim.id, errorNote ? 'failed' : 'succeeded', summary);

  return Response.json({
    ok: !errorNote,
    processed,
    sent,
    failed,
    skipped,
    permanentlyFailed,
    deactivated,
    partitionKey,
    error: errorNote,
  });
}
