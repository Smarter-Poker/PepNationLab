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
 *   1. Atomically claim it (status pending -> posting) so overlapping runs
 *      never double-post.
 *   2. Run the compliance gate + platform post via dispatchPost().
 *   3. Record the outcome: posted / blocked / failed.
 *
 * Auth: CRON_SECRET Bearer (assertCronAuth). Gated behind SOCIAL_AUTOPOST_ENABLED
 * so a half-configured platform never posts anything.
 */
export const dynamic = 'force-dynamic';

const BATCH_LIMIT = 10;

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  if (!isAutopostEnabled()) {
    return NextResponse.json({ skipped: true, reason: 'SOCIAL_AUTOPOST_ENABLED not true' });
  }

  const supabase = await createServiceClient();

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

  for (const row of (due ?? []) as SocialPost[]) {
    // 1) atomic claim: only the run that flips pending->posting proceeds.
    const { data: claimed } = await supabase
      .from('social_posts')
      .update({ status: 'posting', attempts: row.attempts + 1 })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (!claimed) {
      results.push({ id: row.id, platform: row.platform, outcome: 'skipped_already_claimed' });
      continue;
    }

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

  return NextResponse.json({ processed: results.length, summary, results });
}
