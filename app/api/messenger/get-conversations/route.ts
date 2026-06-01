import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RawConv {
  conversation_id?: string;
  counterparty_id?: string | null;
  counterparty_full_name?: string | null;
  counterparty_username?: string | null;
  counterparty_email?: string | null;
  counterparty_role?: string | null;
  last_message_text?: string | null;
  last_message_at?: string | null;
  unread_count?: number | null;
  type?: string | null;
  [k: string]: unknown;
}

/**
 * round-22 (admin) → round-23 (super_agent + agent-with-downline):
 * the messenger sidebar is a HIERARCHICAL view of the caller's downline,
 * not a flat dump.
 *
 * Roles that trigger hierarchical mode:
 *   - admin                                         (always)
 *   - role='super_agent' OR is_super_agent=true     (always)
 *   - role='agent' AND has at least one downline    (i.e. parent of a
 *     sub-agent / referred researcher) — opt-in by data shape, so a
 *     plain agent with no downline keeps the flat list.
 *
 * Default (no parentId): conversations with the caller's direct downline:
 *   - admin   → top-level agents (parent_agent_id IS NULL, role in
 *               agent/super_agent) PLUS researchers the admin referred.
 *   - other   → profiles where parent_agent_id = caller.id OR
 *               referring_agent_id = caller.id OR
 *               referring_sub_agent_id = caller.id.
 *
 * Drill-down (parentId in body): conversations with the chosen user's
 *   direct downline (parent_agent_id = parentId OR referring_agent_id =
 *   parentId OR referring_sub_agent_id = parentId). Identical across
 *   all hierarchical roles.
 *
 * Group / non-direct conversations and direct DMs with admins are
 * always kept regardless of downline scope.
 *
 * Non-hierarchical callers (researchers, sub-agents, plain agents with
 * no downline) get the unfiltered fn_get_user_conversations RPC result.
 */
async function getDownlineIds(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  callerId: string,
  callerRole: string,
  parentId: string | null,
): Promise<Set<string>> {
  const ids = new Set<string>();

  // Drill-down (any role): identical predicate.
  if (parentId) {
    const [byParent, byReferring, bySubReferring] = await Promise.all([
      svc.from('profiles').select('id').eq('parent_agent_id', parentId).eq('is_active', true).limit(500),
      svc.from('profiles').select('id').eq('referring_agent_id', parentId).eq('is_active', true).limit(500),
      svc.from('profiles').select('id').eq('referring_sub_agent_id', parentId).eq('is_active', true).limit(500),
    ]);
    for (const r of (byParent.data ?? []) as { id: string }[]) ids.add(r.id);
    for (const r of (byReferring.data ?? []) as { id: string }[]) ids.add(r.id);
    for (const r of (bySubReferring.data ?? []) as { id: string }[]) ids.add(r.id);
    return ids;
  }

  // Root level — admin special case (cluster of top-level agents +
  // admin-direct researchers, since admin has no parent_agent_id link).
  if (callerRole === 'admin') {
    const { data: topAgents } = await svc
      .from('profiles')
      .select('id')
      .in('role', ['agent', 'super_agent'])
      .is('parent_agent_id', null)
      .eq('is_active', true)
      .limit(500);
    for (const r of (topAgents ?? []) as { id: string }[]) ids.add(r.id);

    const { data: directResearchers } = await svc
      .from('profiles')
      .select('id')
      .eq('referring_agent_id', callerId)
      .eq('is_active', true)
      .limit(500);
    for (const r of (directResearchers ?? []) as { id: string }[]) ids.add(r.id);
    return ids;
  }

  // Root level — super_agent / agent with downline: their direct downline.
  // Use the SAME three-column union as drill-down so the predicate is
  // consistent across all levels of the tree.
  const [byParent, byReferring, bySubReferring] = await Promise.all([
    svc.from('profiles').select('id').eq('parent_agent_id', callerId).eq('is_active', true).limit(500),
    svc.from('profiles').select('id').eq('referring_agent_id', callerId).eq('is_active', true).limit(500),
    svc.from('profiles').select('id').eq('referring_sub_agent_id', callerId).eq('is_active', true).limit(500),
  ]);
  for (const r of (byParent.data ?? []) as { id: string }[]) ids.add(r.id);
  for (const r of (byReferring.data ?? []) as { id: string }[]) ids.add(r.id);
  for (const r of (bySubReferring.data ?? []) as { id: string }[]) ids.add(r.id);
  return ids;
}

/**
 * Decide whether hierarchical mode applies. Admin and super_agent always
 * qualify. Plain agents qualify only if they have at least one downline
 * row (sub-agent or referred researcher) — otherwise their conversation
 * list is short enough that flat is friendlier.
 */
async function shouldUseHierarchy(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  caller: { id: string; role: string; is_super_agent: boolean; is_sub_agent: boolean },
): Promise<boolean> {
  if (caller.role === 'admin') return true;
  if (caller.is_super_agent === true) return true;
  // Sub-agents never get hierarchical view — their researchers attach
  // to the parent's storefront, and they don't manage anyone.
  if (caller.is_sub_agent === true) return false;
  if (caller.role !== 'agent' && caller.role !== 'super_agent') return false;

  // Plain agent: only enable hierarchy if they actually have downline.
  // Cheap probe — one row is enough.
  const { data, error } = await svc
    .from('profiles')
    .select('id', { count: 'exact', head: false })
    .or(`parent_agent_id.eq.${caller.id},referring_agent_id.eq.${caller.id},referring_sub_agent_id.eq.${caller.id}`)
    .neq('id', caller.id)
    .eq('is_active', true)
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('read', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  // Parse optional parentId for drill-down.
  let parentId: string | null = null;
  try {
    const body = (await req.json()) as { parentId?: string | null } | null;
    if (body && typeof body.parentId === 'string' && body.parentId.length > 0) {
      parentId = body.parentId;
    }
  } catch {
    /* no body — keep parentId null */
  }

  const svc = await createServiceClient();

  // Fetch caller role + sub/super flags so we can decide hierarchy mode.
  const { data: me } = await svc
    .from('profiles')
    .select('id, role, is_super_agent, is_sub_agent')
    .eq('id', user.id)
    .maybeSingle();

  const { data, error: rpcErr } = await svc.rpc('fn_get_user_conversations', { p_user: user.id });
  if (rpcErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  let conversations = (data ?? []) as RawConv[];

  if (me) {
    const hierarchical = await shouldUseHierarchy(svc, {
      id: me.id as string,
      role: (me.role ?? '') as string,
      is_super_agent: (me as { is_super_agent?: boolean }).is_super_agent === true,
      is_sub_agent: (me as { is_sub_agent?: boolean }).is_sub_agent === true,
    });

    if (hierarchical) {
      const downlineIds = await getDownlineIds(svc, user.id, (me.role ?? '') as string, parentId);
      conversations = conversations.filter((c) => {
        const cp = c.counterparty_id;
        const role = (c.counterparty_role ?? '').toString();
        // 1) Keep GROUP / non-direct conversations always.
        const isDirect = (c.type ?? '').toString() === 'direct';
        if (!isDirect) return true;
        if (typeof cp !== 'string') return true; // safety
        // 2) Keep direct DMs with admins (peer escalation lane).
        if (role === 'admin') return true;
        // 3) Otherwise enforce downline scope.
        return downlineIds.has(cp);
      });
    }
  }

  const res = NextResponse.json({ conversations });
  res.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return res;
}
