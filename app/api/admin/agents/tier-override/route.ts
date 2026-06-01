import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/agents/tier-override
 * Body: { agentId: string, enabled: boolean, level?: 1..5 }
 *
 * Admin "Fixed Scale Override": hardcode an agent to a specific house tier
 * (e.g. Apex), decoupling their pricing from rolling volume. When enabled the
 * locked level is also written to house_tier_level so the UI/pricing reflect it
 * immediately. When disabled, pricing reverts to volume-driven resolution.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const agentId = typeof body.agentId === 'string' ? body.agentId : '';
  const enabled = body.enabled === true;
  const level = body.level == null ? null : Number(body.level);

  if (!agentId) {
    return NextResponse.json({ error: 'agentId Is Required.' }, { status: 400 });
  }
  if (enabled && (!Number.isInteger(level) || (level as number) < 1 || (level as number) > 5)) {
    return NextResponse.json({ error: 'A Locked Level Between 1 And 5 Is Required When Enabling The Override.' }, { status: 400 });
  }

  const svc = await createServiceClient();

  const { data: target } = await svc.from('profiles').select('id, role').eq('id', agentId).maybeSingle();
  if (!target || !['agent', 'super_agent'].includes(String(target.role))) {
    return NextResponse.json({ error: 'Agent Not Found.' }, { status: 404 });
  }

  const update: Record<string, unknown> = {
    fixed_scale_override: enabled,
    locked_tier_level: enabled ? level : null,
  };
  // Reflect the locked level immediately when enabling; otherwise leave the
  // persisted level for the recompute cron to refresh from volume.
  if (enabled) update.house_tier_level = level;

  const { error } = await svc.from('profiles').update(update).eq('id', agentId);
  if (error) {
    console.error('[tier-override] update error:', error.message);
    return NextResponse.json({ error: 'Failed To Update Override.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, agentId, enabled, level: enabled ? level : null });
}
