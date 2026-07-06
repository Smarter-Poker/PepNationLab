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
import { createAdminClient } from '@/lib/supabase/server';
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
    const svc = createAdminClient();
    const tiers = await getHouseTiers(svc);
    const nameByLevel = new Map(tiers.map((t) => [t.level, t.name]));

    // House-facing agents only
    const { data: agents, error } = await svc
      .from('profiles')
      .select('id, house_tier_level, tier_grace_period_expires_at, grace_period_tier_level, fixed_scale_override, locked_tier_level')
      .in('role', ['agent', 'super_agent'])
      .or('is_sub_agent.is.null,is_sub_agent.eq.false');

    if (error) {
      await finishCronRun(claim.id, 'failed', `query: ${error.message}`.slice(0, 500));
      return NextResponse.json({ error: 'query_failed' }, { status: 500 });
    }

    const now = new Date();

    for (const a of agents ?? []) {
      scanned++;
      const id = a.id as string;
      const oldLevel = a.house_tier_level == null ? null : Number(a.house_tier_level);
      
      // Fixed locks bypass volume rules completely
      if (a.fixed_scale_override && a.locked_tier_level != null) {
        if (oldLevel !== a.locked_tier_level) {
          await svc.from('profiles').update({ house_tier_level: a.locked_tier_level, tier_grace_period_expires_at: null, grace_period_tier_level: null }).eq('id', id);
          changed++;
        }
        continue;
      }

      // Calculate raw earned tier based on actual volume
      const { data: volRes, error: volErr } = await svc.rpc('fn_agent_volume_30d', { p_agent: id });
      if (volErr || volRes == null) continue;
      const vol = Number(volRes);

      let rawEarnedTier = 3; // Default Rookie
      for (const t of tiers) {
        if (vol >= t.min_volume && (t.max_volume == null || vol <= t.max_volume)) {
          rawEarnedTier = t.level;
          break;
        }
      }

      // Grace Period State Machine
      let newLevel = rawEarnedTier;
      let updatePayload: any = {};
      let needsUpdate = false;
      let isPromotion = false;

      if (oldLevel != null && rawEarnedTier > oldLevel) {
        // DEMOTION SCENARIO (e.g. earned Tier 3, was Tier 1)
        const graceExpires = a.tier_grace_period_expires_at ? new Date(a.tier_grace_period_expires_at) : null;
        
        if (!graceExpires) {
          // 1. Start new grace period
          const expiresDate = new Date();
          expiresDate.setDate(expiresDate.getDate() + 30);
          updatePayload = {
            tier_grace_period_expires_at: expiresDate.toISOString(),
            grace_period_tier_level: oldLevel,
            house_tier_level: oldLevel // They keep their current level
          };
          needsUpdate = true;
          // Notify agent that their tier grace period has started
          try {
            const tierName = nameByLevel.get(rawEarnedTier) ?? `Level ${rawEarnedTier}`;
            const graceName = nameByLevel.get(oldLevel) ?? `Level ${oldLevel}`;
            await svc.from('notifications').insert({
              user_id: id,
              type: 'system',
              title: 'Tier Grace Period Started',
              body: `Your volume has dropped to ${tierName} range. You have 30 days to recover before your pricing updates from ${graceName}. Keep selling to maintain your current tier!`,
              url: '/dashboard',
            });
          } catch { /* notification is non-critical */ }
        } else if (now < graceExpires) {
          // 2. Active grace period continues
          // No DB update needed, but we ensure their house_tier_level reflects the grace tier
          if (oldLevel !== a.grace_period_tier_level) {
            updatePayload = { house_tier_level: a.grace_period_tier_level };
            needsUpdate = true;
          }
        } else {
          // 3. Grace period expired! Actually demote them.
          updatePayload = {
            tier_grace_period_expires_at: null,
            grace_period_tier_level: null,
            house_tier_level: rawEarnedTier
          };
          needsUpdate = true;
        }
      } else {
        // PROMOTION OR HOLDING STEADY (e.g. earned Tier 1, was Tier 3 or Tier 1)
        if (oldLevel != null && rawEarnedTier < oldLevel) {
          isPromotion = true;
        }
        
        // Clear any active grace periods since they recovered or promoted
        if (a.tier_grace_period_expires_at || a.grace_period_tier_level || oldLevel !== rawEarnedTier) {
          updatePayload = {
            tier_grace_period_expires_at: null,
            grace_period_tier_level: null,
            house_tier_level: rawEarnedTier
          };
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        const { error: updErr } = await svc.from('profiles').update(updatePayload).eq('id', id);
        if (updErr) continue;
        changed++;

        if (isPromotion) {
          leveledUp++;
          await notifyTierLevelUp(svc, id, nameByLevel.get(rawEarnedTier) ?? `Level ${rawEarnedTier}`);
        }
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
