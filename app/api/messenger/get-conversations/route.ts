import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, canInvite } from '@/lib/messenger/server';
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
 * round-22 (admin) → round-23 (super_agent + agent-with-downline) →
 * round-24 (always-connected drill): the messenger sidebar is a
 * HIERARCHICAL view of the caller's downline, not a flat dump.
 *
 * Roles that trigger hierarchical mode:
 *   - admin                                         (always)
 *   - role='super_agent' OR is_super_agent=true     (always)
 *   - role='agent' AND has at least one downline    (i.e. parent of a
 *     sub-agent / referred researcher) — opt-in by data shape, so a
 *     plain agent with no downline keeps the flat list.
 *
 * Default (no parentId): conversations with the caller's direct downline.
 *
 * Drill-down (parentId in body): EVERY direct downline member of the
 * chosen user (parent_agent_id = parentId OR referring_agent_id = parentId
 * OR referring_sub_agent_id = parentId) is returned as an openable row —
 * not just members the caller has already DM'd. Members with an existing
 * thread reuse it; members without one come back as `new:<memberId>`
 * sentinels the client starts on tap, so every arrow is always connected
 * to the chat display.
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
 * Build openable rows for EVERY direct downline member of parentId. Reuses
 * the caller's existing thread where a DM exists; otherwise returns a
 * `new:<memberId>` sentinel the client opens via start-conversation.
 */
async function buildDownlineRows(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  viewerId: string,
  parentId: string,
  existing: RawConv[],
): Promise<RawConv[]> {
  const byCounterparty = new Map<string, RawConv>();
  for (const c of existing) {
    if (typeof c.counterparty_id === 'string') byCounterparty.set(c.counterparty_id, c);
  }

  const [byParent, byReferring, bySubReferring] = await Promise.all([
    svc.from('profiles').select('id, full_name, username, role').eq('parent_agent_id', parentId).eq('is_active', true).limit(500),
    svc.from('profiles').select('id, full_name, username, role').eq('referring_agent_id', parentId).eq('is_active', true).limit(500),
    svc.from('profiles').select('id, full_name, username, role').eq('referring_sub_agent_id', parentId).eq('is_active', true).limit(500),
  ]);

  const members = new Map<string, { id: string; full_name: string | null; username: string | null; role: string | null }>();
  for (const r of [...((byParent.data ?? []) as never[]), ...((byReferring.data ?? []) as never[]), ...((bySubReferring.data ?? []) as never[])]) {
    const m = r as { id: string; full_name: string | null; username: string | null; role: string | null };
    if (m.id !== viewerId) members.set(m.id, m);
  }

  const rows: RawConv[] = [];
  for (const m of members.values()) {
    const ex = byCounterparty.get(m.id);
    if (ex) {
      rows.push(ex);
    } else {
      rows.push({
        conversation_id: `new:${m.id}`,
        type: 'direct',
        title: null,
        avatar_url: null,
        last_message_text: null,
        last_message_at: null,
        unread_count: 0,
        is_pinned: false,
        is_muted: false,
        counterparty_id: m.id,
        counterparty_full_name: m.full_name,
        counterparty_username: m.username,
        counterparty_role: m.role,
        counterparty_avatar_url: null,
      });
    }
  }

  rows.sort((a, b) => {
    const an = (a.counterparty_full_name || a.counterparty_username || '').toLowerCase();
    const bn = (b.counterparty_full_name || b.counterparty_username || '').toLowerCase();
    return an.localeCompare(bn);
  });

  return rows;
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
    const role = (me.role ?? '') as string;
    const hierarchical = await shouldUseHierarchy(svc, {
      id: me.id as string,
      role,
      is_super_agent: (me as { is_super_agent?: boolean }).is_super_agent === true,
      is_sub_agent: (me as { is_sub_agent?: boolean }).is_sub_agent === true,
    });

    if (hierarchical) {
      if (parentId) {
        // DRILL: surface EVERY downline member as an openable row, so the
        // arrow is always connected even before a DM exists. Authorized
        // with the same canInvite() network check used to start the DM.
        const allowed = role === 'admin' || parentId === user.id || (await canInvite(user.id, parentId));
        if (allowed) {
          conversations = await buildDownlineRows(svc, user.id, parentId, conversations);
        } else {
          // Out of network — fall back to the safe filtered view.
          const downlineIds = await getDownlineIds(svc, user.id, role, parentId);
          conversations = conversations.filter((c) => {
            const cp = c.counterparty_id;
            const isDirect = (c.type ?? '').toString() === 'direct';
            if (!isDirect) return true;
            if (typeof cp !== 'string') return true;
            if ((c.counterparty_role ?? '').toString() === 'admin') return true;
            return downlineIds.has(cp);
          });
        }
      } else {
        // ROOT: conversations with the caller's direct downline (unchanged).
        const downlineIds = await getDownlineIds(svc, user.id, role, null);
        conversations = conversations.filter((c) => {
          const cp = c.counterparty_id;
          const cRole = (c.counterparty_role ?? '').toString();
          const isDirect = (c.type ?? '').toString() === 'direct';
          if (!isDirect) return true;
          if (typeof cp !== 'string') return true;
          if (cRole === 'admin') return true;
          return downlineIds.has(cp);
        });
      }
    }
  }

  const res = NextResponse.json({ conversations });
  res.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return res;
}
