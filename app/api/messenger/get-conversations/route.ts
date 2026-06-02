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
async function buildDownlineRows(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  viewerId: string,
  parentId: string | null,
  callerRole: string,
  existing: RawConv[],
): Promise<RawConv[]> {
  const byCounterparty = new Map<string, RawConv>();
  for (const c of existing) {
    if (typeof c.counterparty_id === 'string') byCounterparty.set(c.counterparty_id, c);
  }

  let membersData: { id: string; full_name: string | null; username: string | null; role: string | null }[] = [];

  if (parentId) {
    const [byParent, byReferring, bySubReferring] = await Promise.all([
      svc.from('profiles').select('id, full_name, username, role').eq('parent_agent_id', parentId).eq('is_active', true).limit(500),
      svc.from('profiles').select('id, full_name, username, role').eq('referring_agent_id', parentId).eq('is_active', true).limit(500),
      svc.from('profiles').select('id, full_name, username, role').eq('referring_sub_agent_id', parentId).eq('is_active', true).limit(500),
    ]);
    membersData = [...((byParent.data ?? []) as never[]), ...((byReferring.data ?? []) as never[]), ...((bySubReferring.data ?? []) as never[])];
  } else {
    if (callerRole === 'admin') {
      const { data: topAgents } = await svc
        .from('profiles')
        .select('id, full_name, username, role')
        .in('role', ['agent', 'super_agent'])
        .is('parent_agent_id', null)
        .eq('is_active', true)
        .limit(500);
      const { data: directResearchers } = await svc
        .from('profiles')
        .select('id, full_name, username, role')
        .eq('referring_agent_id', viewerId)
        .eq('is_active', true)
        .limit(500);
      membersData = [...((topAgents ?? []) as never[]), ...((directResearchers ?? []) as never[])];
    } else {
      const [byParent, byReferring, bySubReferring] = await Promise.all([
        svc.from('profiles').select('id, full_name, username, role').eq('parent_agent_id', viewerId).eq('is_active', true).limit(500),
        svc.from('profiles').select('id, full_name, username, role').eq('referring_agent_id', viewerId).eq('is_active', true).limit(500),
        svc.from('profiles').select('id, full_name, username, role').eq('referring_sub_agent_id', viewerId).eq('is_active', true).limit(500),
      ]);
      membersData = [...((byParent.data ?? []) as never[]), ...((byReferring.data ?? []) as never[]), ...((bySubReferring.data ?? []) as never[])];
    }
  }

  const members = new Map<string, typeof membersData[0]>();
  for (const m of membersData) {
    if (m.id !== viewerId) members.set(m.id, m);
  }

  const rows: RawConv[] = [];
  for (const m of members.values()) {
    const ex = byCounterparty.get(m.id);
    if (ex) {
      rows.push(ex);
      byCounterparty.delete(m.id);
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

  // Preserve existing conversations with admins, groups, and announcements.
  // Direct conversations whose counterparty did not resolve (typeof !==
  // 'string') are ORPHANS — either a half-created row or a deleted partner
  // — and rendering them as a generic "Direct Message" row encouraged users
  // to click them, which created MORE orphans. We drop them silently. The
  // database-side fn_get_user_conversations RPC already filters most of
  // these out at the source; this is belt-and-braces.
  for (const c of existing) {
    if (typeof c.counterparty_id === 'string' && byCounterparty.has(c.counterparty_id)) {
      const cRole = (c.counterparty_role ?? '').toString();
      const isDirect = (c.type ?? '').toString() === 'direct';
      if (!isDirect) {
        rows.push(c);
      } else if (cRole === 'admin') {
        rows.push(c);
      }
    } else if (typeof c.counterparty_id !== 'string') {
      // No resolvable counterparty.
      const isDirect = (c.type ?? '').toString() === 'direct';
      if (isDirect) {
        // Orphan direct conversation. Suppress.
        continue;
      }
      // Groups and announcements legitimately have no counterparty_id; keep.
      rows.push(c);
    }
  }

  rows.sort((a, b) => {
    const aAdmin = a.counterparty_role === 'admin' ? 0 : 1;
    const bAdmin = b.counterparty_role === 'admin' ? 0 : 1;
    if (aAdmin !== bAdmin) return aAdmin - bAdmin;

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
  if (caller.is_sub_agent === true) return false;
  if (caller.role !== 'agent' && caller.role !== 'super_agent') return false;

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
        const allowed = role === 'admin' || parentId === user.id || (await canInvite(user.id, parentId));
        if (allowed) {
          conversations = await buildDownlineRows(svc, user.id, parentId, role, conversations);
        } else {
          const membersData = await buildDownlineRows(svc, user.id, parentId, role, []);
          const downlineIds = new Set(membersData.map(m => m.counterparty_id));
          conversations = conversations.filter((c) => {
            const cp = c.counterparty_id;
            const isDirect = (c.type ?? '').toString() === 'direct';
            if (!isDirect) return true;
            if (typeof cp !== 'string') return false;
            if ((c.counterparty_role ?? '').toString() === 'admin') return true;
            return downlineIds.has(cp);
          });
        }
      } else {
        conversations = await buildDownlineRows(svc, user.id, null, role, conversations);
      }
    } else {
      // Flat-mode caller (plain agent with no downline). Still drop direct
      // orphans with no resolvable counterparty so they can't pollute the
      // inbox after a half-created insert.
      conversations = conversations.filter((c) => {
        const isDirect = (c.type ?? '').toString() === 'direct';
        if (!isDirect) return true;
        return typeof c.counterparty_id === 'string';
      });
    }
  }

  const res = NextResponse.json({ conversations });
  res.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return res;
}
