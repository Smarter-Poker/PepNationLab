import type { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { sendSmsViaTwilio, isTwilioConfigured } from '@/lib/twilio';

export const dynamic = 'force-dynamic';

const BATCH_LIMIT = 50;

interface OutboxRow {
  id: string;
  to_phone: string;
  body: string;
}

function hourlyPartitionKey(d: Date = new Date()): string {
  // YYYY-MM-DD HH:00 in UTC — matches the cron schedule (hourly at :15).
  const iso = d.toISOString();
  const date = iso.slice(0, 10);
  const hour = iso.slice(11, 13);
  return `${date} ${hour}:00`;
}

export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partitionKey = hourlyPartitionKey();
  const claim = await claimCronRun('sms_dispatch', partitionKey);
  if (!claim) {
    return Response.json({ skipped: true, reason: 'already_ran_this_hour' });
  }

  let processed = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let errorNote: string | null = null;

  try {
    const supabase = await createServiceClient();
    const twilioOn = isTwilioConfigured();

    const { data: rows, error } = await supabase
      .from('sms_outbox')
      .select('id, to_phone, body')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(BATCH_LIMIT);

    if (error) {
      errorNote = `select_failed: ${error.message}`.slice(0, 300);
    } else {
      for (const row of (rows ?? []) as OutboxRow[]) {
        processed++;
        if (!twilioOn) {
          await supabase
            .from('sms_outbox')
            .update({
              status: 'skipped',
              failure_reason: 'twilio_not_configured',
              sent_at: new Date().toISOString(),
            })
            .eq('id', row.id);
          skipped++;
          continue;
        }

        const result = await sendSmsViaTwilio({ to: row.to_phone, body: row.body });
        if (result.ok) {
          await supabase
            .from('sms_outbox')
            .update({
              status: 'sent',
              provider_message_id: result.messageId ?? null,
              sent_at: new Date().toISOString(),
              failure_reason: null,
            })
            .eq('id', row.id);
          sent++;
        } else {
          await supabase
            .from('sms_outbox')
            .update({
              status: 'failed',
              failure_reason: (result.error ?? 'unknown').slice(0, 300),
              sent_at: new Date().toISOString(),
            })
            .eq('id', row.id);
          failed++;
        }
      }
    }
  } catch (err: unknown) {
    errorNote = err instanceof Error ? err.message.slice(0, 300) : 'unknown_error';
  }

  const summary = `processed=${processed} sent=${sent} failed=${failed} skipped=${skipped}${errorNote ? ` err=${errorNote}` : ''}`;
  await finishCronRun(claim.id, errorNote ? 'failed' : 'succeeded', summary);

  return Response.json({
    ok: !errorNote,
    processed,
    sent,
    failed,
    skipped,
    partitionKey,
    error: errorNote,
  });
}
