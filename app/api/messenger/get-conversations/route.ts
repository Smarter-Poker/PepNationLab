import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, canInvite } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { maskAdminCounterparty } from '@/lib/messenger/identity';

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
 * A counterparty/member is "nameless" when both username AND full_name are
 * absent. Such rows render as a generic "Direct Message" pill which looks
 * broken and invites accidental clicks that create more orphan threads.
 * Skip them everywhere.
 */
function nameless(name: { full_name?: string | null; username?: string | null } | undefined | null): boolean {
  const fn = (name?.full_name ?? '').toString().trim();
  const un = (name?.username ?? '').toString().trim();
  return fn.length === 0 && un.length === 0;
}

/**
 * Inbox ordering: most recent conversation first.
 *
 * Users expect the thread they last chatted or called on to sit at the top,
 * not an alphabetical roster. We order by last_message_at descending (newest
 * first), with never-messaged rows (the `new:` downline stubs and any thread
 * with no activity) falling to the bottom. Within the no-activity bucket we
 * keep a deterministic, tidy order: admins first, then alphabetical by name.
 * Pinned conversations stay on top regardless, preserving the pin feature.
 */
function lastActivityMs(c: RawConv): number {
  const t = c.last_message_at;
  if (!t) return 0;
  const ms = new Date(t as string).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function sortByRecency(a: RawConv, b: RawConv): number {
  const aPin = (a as { is_pinned?: boolean }).is_pinned === true ? 1 : 0;
  const bPin = (b as { is_pinned?: boolean }).is_pinned === true ? 1 : 0;
  if (aPin !== bPin) return bPin - aPin;

  const at = lastActivityMs(a);
  const bt = lastActivityMs(b);
  if (at !== bt) return bt - at;

  const aAdmin = a.counterparty_role === 'admin' ? 0 : 1;
  const bAdmin = b.counterparty_role === 'admin' ? 0 : 1;
  if (aAdmin !== bAdmin) return aAdmin - bAdmin;

  const aName = (a.counterparty_full_name || a.counterparty_username || (a as { title?: string | null }).title || '')
    .toString()
    .toLowerCase();
  const bName = (b.counterparty_full_name || b.counterparty_username || (b as { title?: string | null }).title || '')
    .toString()
    .toLowerCase();
  return aName.localeCompare(bName);
}

/**
 * round-22 / round-23 / round-24: hierarchical view of the downline tree
 * with always-connected drill-down. Drops orphan and nameless rows.
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
    if (m.id === viewerId) continue;
    // Skip downline members with no usable identity - they were almost
    // certainly created by an E2E/test path and should not render.
    if (nameless(m)) continue;
    members.set(m.id, m);
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
  // Direct conversations whose counterparty did not resolve OR is nameless
  // are dropped silently - they were the source of the "Direct Message /
  // No Messages Yet" mess.
  for (const c of existing) {
    if (typeof c.counterparty_id === 'string' && byCounterparty.has(c.counterparty_id)) {
      const cRole = (c.counterparty_role ?? '').toString();
      const isDirect = (c.type ?? '').toString() === 'direct';
      const cpNameless = nameless({
        full_name: c.counterparty_full_name,
        username: c.counterparty_username,
      });
      if (cpNameless) continue;
      if (!isDirect) {
        rows.push(c);
      } else if (cRole === 'admin') {
        rows.push(c);
      }
    } else if (typeof c.counterparty_id !== 'string') {
      const isDirect = (c.type ?? '').toString() === 'direct';
      if (isDirect) continue; // orphan direct, suppress
      rows.push(c); // groups / announcements without counterparty
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
    .select('id')
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
    /* no body */
  }

  const svc = await createServiceClient();

  const { data: me } = await svc
    .from('profiles')
    .select('id, role, is_super_agent, is_sub_agent, referring_agent_id, referring_sub_agent_id')
    .eq('id', user.id)
    .maybeSingle();

  const { data, error: rpcErr } = await svc.rpc('fn_get_user_conversations', { p_user: user.id });
  if (rpcErr) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });

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
            if (nameless({ full_name: c.counterparty_full_name, username: c.counterparty_username })) return false;
            if ((c.counterparty_role ?? '').toString() === 'admin') return true;
            return downlineIds.has(cp);
          });
        }
      } else {
        conversations = await buildDownlineRows(svc, user.id, null, role, conversations);
      }
    } else {
      // Flat-mode caller. Drop direct orphans (no counterparty) and nameless
      // partners so the inbox can't show "Direct Message" rows here either.
      conversations = conversations.filter((c) => {
        const isDirect = (c.type ?? '').toString() === 'direct';
        if (!isDirect) return true;
        if (typeof c.counterparty_id !== 'string') return false;
        return !nameless({ full_name: c.counterparty_full_name, username: c.counterparty_username });
      });
    }

    if (me.role === 'researcher') {
      const existingCounterparties = new Set(
        conversations
          .map((c) => c.counterparty_id)
          .filter((id): id is string => typeof id === 'string')
      );

      const neededAgentIds: string[] = [];
      if (me.referring_agent_id && !existingCounterparties.has(me.referring_agent_id)) {
        neededAgentIds.push(me.referring_agent_id);
      }
      if (me.referring_sub_agent_id && !existingCounterparties.has(me.referring_sub_agent_id)) {
        neededAgentIds.push(me.referring_sub_agent_id);
      }

      if (neededAgentIds.length > 0) {
        const { data: agentProfiles } = await svc
          .from('profiles')
          .select('id, full_name, username, role, avatar_url')
          .in('id', neededAgentIds)
          .eq('is_active', true);

        if (agentProfiles) {
          for (const ap of agentProfiles) {
            if (nameless(ap)) continue;
            conversations.push({
              conversation_id: `new:${ap.id}`,
              type: 'direct',
              title: null,
              avatar_url: null,
              last_message_text: null,
              last_message_at: null,
              unread_count: 0,
              is_pinned: false,
              is_muted: false,
              counterparty_id: ap.id,
              counterparty_full_name: ap.full_name,
              counterparty_username: ap.username,
              counterparty_role: ap.role,
              counterparty_avatar_url: ap.avatar_url,
            });
          }
        }
      }
    }
  }

  // Final canonical ordering for every viewer type (hierarchical, flat, and
  // researcher-appended stubs): most recent conversation at the top.
  conversations.sort(sortByRecency);

  // Non-admin viewers must see any admin counterparty (e.g. the standing admin
  // support DM) as the generic "PepNation Support" identity (display only).
  const viewerIsAdmin = ((me as { role?: string } | null)?.role ?? null) === 'admin';
  conversations = conversations.map((c) => maskAdminCounterparty(c, viewerIsAdmin));

  const res = NextResponse.json({ conversations });
  res.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return res;
}
