/**
 * GET /api/cron/tier-recompute
 *
 * Recomputes each House-facing agent's gamification tier from their rolling
 * 30-day wholesale volume (incl. sub-agent roll-up) and persists it to
 * profiles.house_tier_level. On a level-UP, fires an "Achievement Unlocked"
 * notification. No-op unless the tier-ladder v2 flag is enabled, so no
 * misleading "your cost dropped" alerts fire before launch.
 *
 * Pricing also resolves tiers live per request; this job exists to (a) persist
 * the level for UI/leaderboards and (b) detect level changes for notifications.
 */
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { isTierLadderV2, getHouseTiers } from '@/lib/pricing';
import { notifyTierLevelUp } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  if (!isTierLadderV2()) {
    return NextResponse.json({ skipped: true, reason: 'tier_ladder_v2_disabled' });
  }

  const partitionKey = new Date().toISOString().slice(0, 10);
  const claim = await claimCronRun('tier_recompute', partitionKey);
  if (!claim) return NextResponse.json({ skipped: true, reason: 'already_ran' });

  let scanned = 0;
  let changed = 0;
  let leveledUp = 0;

  try {
    const svc = await createServiceClient();
    const tiers = await getHouseTiers(svc);
    const nameByLevel = new Map(tiers.map((t) => [t.level, t.name]));

    // House-facing agents only (sub-agents price off their super-agent, not the House).
    const { data: agents, error } = await svc
      .from('profiles')
      .select('id, house_tier_level')
      .in('role', ['agent', 'super_agent'])
      .or('is_sub_agent.is.null,is_sub_agent.eq.false');

    if (error) {
      await finishCronRun(claim.id, 'failed', `query: ${error.message}`.slice(0, 500));
      return NextResponse.json({ error: 'query_failed' }, { status: 500 });
    }

    for (const a of agents ?? []) {
      scanned++;
      const id = a.id as string;
      const oldLevel = a.house_tier_level == null ? null : Number(a.house_tier_level);
      const { data: lvlData, error: lvlErr } = await svc.rpc('fn_resolve_house_tier_level', { p_agent: id });
      if (lvlErr || lvlData == null) continue;
      const newLevel = Number(lvlData);
      if (newLevel === oldLevel) continue;

      const { error: updErr } = await svc.from('profiles').update({ house_tier_level: newLevel }).eq('id', id);
      if (updErr) continue;
      changed++;

      // Only celebrate an actual climb (old known and lower); skip first-seed + demotions.
      if (oldLevel != null && newLevel > oldLevel) {
        leveledUp++;
        await notifyTierLevelUp(svc, id, nameByLevel.get(newLevel) ?? `Level ${newLevel}`);
      }
    }

    await finishCronRun(claim.id, 'succeeded', `scanned=${scanned} changed=${changed} levelUp=${leveledUp}`);
    return NextResponse.json({ success: true, scanned, changed, leveledUp });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    await finishCronRun(claim.id, 'failed', msg.slice(0, 500));
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
