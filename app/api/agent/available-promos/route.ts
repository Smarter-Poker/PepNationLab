export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/agent/available-promos
 *
 * Active sign-up promo codes the signed-in agent-tier user can advertise:
 *   - every live platform promo (admin-created, applies to any signup), and
 *   - the caller's own agent-scoped promos (if they are a super-agent).
 * Returns canManage + manageHref so the Referral Codes hub can offer a
 * create/manage shortcut to admins and super-agents.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const svc = await createServiceClient();
  const { data: profile } = await svc
    .from('profiles')
    .select('role, is_super_agent, is_sub_agent')
    .eq('id', user.id)
    .maybeSingle();

  const isAdmin = profile?.role === 'admin';
  const isSuper = profile?.role === 'super_agent' || profile?.is_super_agent === true;
  const isAgentTier = isAdmin || isSuper || profile?.role === 'agent' || !!profile?.is_sub_agent;
  if (!isAgentTier) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  const nowIso = new Date().toISOString();
  const { data: rows } = await svc
    .from('signup_promo_codes')
    .select('id, code, name, reward_key, is_active, max_uses, uses_count, starts_at, ends_at, scope, owner_agent_id')
    .eq('is_active', true)
    .or(`scope.eq.platform,owner_agent_id.eq.${user.id}`)
    .lte('starts_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: catalog } = await svc
    .from('signup_promo_reward_catalog')
    .select('key, label');
  const labelByKey = new Map((catalog ?? []).map((c: { key: string; label: string }) => [c.key, c.label]));

  const now = Date.now();
  const promos = (rows ?? [])
    .filter(r => (!r.ends_at || new Date(r.ends_at).getTime() > now))
    .filter(r => (r.max_uses == null || (r.uses_count ?? 0) < r.max_uses))
    .map(r => ({
      code: r.code,
      name: r.name,
      rewardLabel: labelByKey.get(r.reward_key) ?? r.reward_key,
      scope: r.scope,
      mine: r.owner_agent_id === user.id,
    }));

  return NextResponse.json({
    promos,
    canManage: isAdmin || isSuper,
    manageHref: isAdmin ? '/admin/signup-promos' : (isSuper ? '/dashboard/agent/promos' : null),
  });
}
