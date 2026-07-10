import { NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron';
import { createServiceClient } from '@/lib/supabase/server';
import {
  dispatchPost,
  isAutopostEnabled,
  ComplianceBlockError,
  type SocialPost,
} from '@/lib/social';

/**
 * Social autoposter cron - drains the public.social_posts queue.
 *
 * Runs hourly (vercel.json). For each pending post that is due:
 *   1. Atomically claim it (status pending -> posting, stamping
 *      posting_started_at) so overlapping runs never double-post.
 *   2. Run the compliance gate + platform post via dispatchPost().
 *   3. Record the outcome: posted / blocked / failed.
 *
 * Before draining, it sweeps rows stranded in 'posting' by a crashed or
 * timed-out previous run. Those are marked 'failed', never re-queued: the post
 * may already be live on the platform, so an automatic retry risks publishing
 * twice to a real account. An admin verifies, then retries from the console.
 *
 * Auth: CRON_SECRET Bearer (assertCronAuth). Gated behind SOCIAL_AUTOPOST_ENABLED
 * so a half-configured platform never posts anything.
 */
export const dynamic = 'force-dynamic';

/** Total posts drained per run. */
const BATCH_LIMIT = 10;

/**
 * Max posts sent to any ONE platform per run. Bursting a pile of posts at a
 * single platform is exactly what spam heuristics flag, and these are
 * brand accounts we cannot afford to lose.
 */
const PER_PLATFORM_LIMIT = 2;

/** A row claimed longer than this is considered stranded by a dead run. */
const STUCK_POSTING_MINUTES = 15;

const STUCK_ERROR =
  'Stranded in posting (cron crashed or timed out). This post may ALREADY be live on the platform - ' +
  'verify on the account before retrying, or it could publish twice.';

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  if (!isAutopostEnabled()) {
    return NextResponse.json({ skipped: true, reason: 'SOCIAL_AUTOPOST_ENABLED not true' });
  }

  const supabase = await createServiceClient();

  // ── 0) Sweep rows stranded in 'posting' by a dead previous run. ───────────
  // Marked failed, NOT pending: they may already have published.
  const stuckCutoff = new Date(Date.now() - STUCK_POSTING_MINUTES * 60_000).toISOString();
  const { data: stuck } = await supabase
    .from('social_posts')
    .update({ status: 'failed', error: STUCK_ERROR })
    .eq('status', 'posting')
    .lt('posting_started_at', stuckCutoff)
    .select('id');
  const reaped = stuck?.length ?? 0;

  // ── 1) Pull the due queue. ───────────────────────────────────────────────
  const { data: due, error } = await supabase
    .from('social_posts')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{ id: string; platform: string; outcome: string }> = [];
  const sentPerPlatform = new Map<string, number>();

  for (const row of (due ?? []) as SocialPost[]) {
    // ── 2) Per-platform burst cap. Deferred rows stay 'pending' and are
    //       simply picked up by the next hourly run.
    const alreadySent = sentPerPlatform.get(row.platform) ?? 0;
    if (alreadySent >= PER_PLATFORM_LIMIT) {
      results.push({ id: row.id, platform: row.platform, outcome: 'deferred_rate_limit' });
      continue;
    }

    // ── 3) Atomic claim: only the run that flips pending->posting proceeds.
    const { data: claimed } = await supabase
      .from('social_posts')
      .update({
        status: 'posting',
        attempts: row.attempts + 1,
        posting_started_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (!claimed) {
      results.push({ id: row.id, platform: row.platform, outcome: 'skipped_already_claimed' });
      continue;
    }

    // Count the ATTEMPT, not the success: a platform that is erroring should not
    // be hammered for the rest of the run just because nothing published.
    sentPerPlatform.set(row.platform, alreadySent + 1);

    try {
      const res = await dispatchPost(row.platform, {
        mediaUrl: row.media_url,
        mediaType: row.media_type,
        caption: row.caption,
        link: row.link,
      });
      await supabase
        .from('social_posts')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
          platform_post_id: res.id,
          platform_url: res.url ?? null,
          compliance_checked: true,
          error: null,
        })
        .eq('id', row.id);
      results.push({ id: row.id, platform: row.platform, outcome: 'posted' });
    } catch (err) {
      if (err instanceof ComplianceBlockError) {
        await supabase
          .from('social_posts')
          .update({
            status: 'blocked',
            compliance_checked: true,
            compliance_notes: `blocked: ${err.blocked.join(', ')}`,
            error: null,
          })
          .eq('id', row.id);
        results.push({ id: row.id, platform: row.platform, outcome: 'blocked' });
      } else {
        const message = err instanceof Error ? err.message : String(err);
        await supabase
          .from('social_posts')
          .update({ status: 'failed', error: message.slice(0, 1000) })
          .eq('id', row.id);
        results.push({ id: row.id, platform: row.platform, outcome: 'failed' });
      }
    }
  }

  const summary = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.outcome] = (acc[r.outcome] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({ processed: results.length, reaped, summary, results });
}
