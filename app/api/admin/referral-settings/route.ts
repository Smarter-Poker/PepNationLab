import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/referral-settings — return the singleton settings row.
 */
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const service = await createServiceClient();
  const { data, error } = await service
    .from('referral_settings')
    .select('referrer_reward, referee_reward, min_order_total, is_active, updated_at, updated_by')
    .eq('id', 1)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
  return NextResponse.json({ settings: data });
}

/**
 * PATCH /api/admin/referral-settings — accept any subset of the four mutable
 * fields and persist them. Logs the diff to admin_audit_log.
 */
export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid Body' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.referrer_reward !== undefined) {
    const v = Number(body.referrer_reward);
    if (!Number.isFinite(v) || v < 0 || v > 10000) {
      return NextResponse.json({ error: 'Referrer Reward Must Be Between 0 And 10000' }, { status: 400 });
    }
    patch.referrer_reward = v;
  }
  if (body.referee_reward !== undefined) {
    const v = Number(body.referee_reward);
    if (!Number.isFinite(v) || v < 0 || v > 10000) {
      return NextResponse.json({ error: 'Referee Reward Must Be Between 0 And 10000' }, { status: 400 });
    }
    patch.referee_reward = v;
  }
  if (body.min_order_total !== undefined) {
    const v = Number(body.min_order_total);
    if (!Number.isFinite(v) || v < 0 || v > 100000) {
      return NextResponse.json({ error: 'Minimum Order Total Must Be Between 0 And 100000' }, { status: 400 });
    }
    patch.min_order_total = v;
  }
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') {
      return NextResponse.json({ error: 'is_active Must Be Boolean' }, { status: 400 });
    }
    patch.is_active = body.is_active;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No Updatable Fields Provided' }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: before } = await service
    .from('referral_settings')
    .select('referrer_reward, referee_reward, min_order_total, is_active')
    .eq('id', 1)
    .maybeSingle();

  patch.updated_at = new Date().toISOString();
  patch.updated_by = gate.userId;

  const { error: updateError } = await service
    .from('referral_settings')
    .update(patch)
    .eq('id', 1);
  if (updateError) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  await service.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'referral_settings_update',
    entity_type: 'referral_settings',
    entity_id: '1',
    changes: { before, after: patch },
  });

  return NextResponse.json({ ok: true });
}
