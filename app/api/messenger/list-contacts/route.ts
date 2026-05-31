import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ContactRow {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  role: string;
}

// Audit12: admins always sort to the top of every non-admin caller's contact
// list so agents/super_agents/researchers can find platform support quickly.
function sortContacts(rows: ContactRow[]): ContactRow[] {
  return rows
    .filter((r) => r && r.id)
    .sort((a, b) => {
      const aAdmin = a.role === 'admin' ? 0 : 1;
      const bAdmin = b.role === 'admin' ? 0 : 1;
      if (aAdmin !== bAdmin) return aAdmin - bAdmin;
      const an = (a.full_name ?? a.username ?? a.email ?? '').toLowerCase();
      const bn = (b.full_name ?? b.username ?? b.email ?? '').toLowerCase();
      return an.localeCompare(bn);
    });
}

// Audit12: every non-admin caller should always have at least the platform
// admin(s) in their contact list. Returns active admin profiles excluding
// the caller.
async function loadAdminContacts(
  svc: ReturnType<typeof createServiceClient> extends Promise<infer T> ? T : never,
  excludeId: string,
): Promise<ContactRow[]> {
  const { data, error } = await svc
    .from('profiles')
    .select('id, full_name, username, email, role')
    .eq('role', 'admin')
    .eq('is_active', true)
    .neq('id', excludeId)
    .limit(50);
  if (error) {
    // Audit13: surface this in server logs so a silently failing query is
    // not the reason the picker stays empty.
    console.error('[list-contacts] loadAdminContacts failed', error);
    return [];
  }
  return (data ?? []) as ContactRow[];
}

// Audit13: every response uses these headers so no intermediate cache can
// serve a stale contact list (Vercel's default `cache-control: max-age=0,
// must-revalidate` allows the browser to hold a cached copy until a
// revalidation round-trip; we want zero cache).
function freshJson(body: unknown): NextResponse {
  const res = NextResponse.json(body);
  res.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return res;
}

const AUDIT_TAG = 'audit13';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('read', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  const svc = await createServiceClient();

  const { data: me } = await svc
    .from('profiles')
    .select('id, role, parent_agent_id, referring_agent_id, is_sub_agent, referring_sub_agent_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!me) return freshJson({ contacts: [], _audit: AUDIT_TAG, _branch: 'no_profile' });

  const SELECT = 'id, full_name, username, email, role';
  const selectActive = (q: ReturnType<typeof svc.from>) => q.select(SELECT).eq('is_active', true).neq('id', me.id);

  if (me.role === 'admin') {
    const { data } = await selectActive(svc.from('profiles')).limit(200);
    return freshJson({
      contacts: sortContacts((data ?? []) as ContactRow[]),
      _audit: AUDIT_TAG,
      _branch: 'admin',
    });
  }

  if (me.role === 'super_agent') {
    const { data: directDownline } = await selectActive(svc.from('profiles'))
      .eq('parent_agent_id', me.id)
      .limit(200);
    const downlineRows = (directDownline ?? []) as ContactRow[];
    const agentIds = downlineRows.filter((r) => r.role === 'agent').map((r) => r.id);
    let researcherRows: ContactRow[] = [];
    if (agentIds.length > 0) {
      const { data: researchers } = await selectActive(svc.from('profiles'))
        .in('referring_agent_id', agentIds)
        .limit(500);
      researcherRows = (researchers ?? []) as ContactRow[];
    }
    const admins = await loadAdminContacts(svc, me.id);
    const byId = new Map<string, ContactRow>();
    for (const r of [...downlineRows, ...researcherRows, ...admins]) byId.set(r.id, r);
    return freshJson({
      contacts: sortContacts(Array.from(byId.values())),
      _audit: AUDIT_TAG,
      _branch: 'super_agent',
      _adminCount: admins.length,
    });
  }

  if (me.role === 'agent') {
    const meIsSubAgent = (me as { is_sub_agent?: boolean | null }).is_sub_agent === true;
    // Regular agents and super-agents-as-agents own researchers via referring_agent_id.
    // Sub-agents do not own any researchers via referring_agent_id (those rows point
    // to the sub-agent's parent), so for sub-agent callers we instead fetch the
    // researchers that were tagged to them via referring_sub_agent_id — that is
    // the SACA commission link and represents the customers the sub-agent created.
    const researcherQuery = meIsSubAgent
      ? selectActive(svc.from('profiles')).eq('referring_sub_agent_id', me.id)
      : selectActive(svc.from('profiles')).eq('referring_agent_id', me.id);
    const { data: researchers } = await researcherQuery.limit(500);
    // Sub-agents cannot have nested sub-agents, but the no-op query is cheap
    // and keeps the code path identical for both branches.
    const { data: subAgents } = await selectActive(svc.from('profiles'))
      .eq('parent_agent_id', me.id)
      .limit(200);
    const byId = new Map<string, ContactRow>();
    for (const r of [...(researchers ?? []), ...(subAgents ?? [])] as ContactRow[]) byId.set(r.id, r);
    if (me.parent_agent_id) {
      const { data: parent } = await svc
        .from('profiles')
        .select(SELECT)
        .eq('id', me.parent_agent_id)
        .eq('is_active', true)
        .maybeSingle();
      if (parent) byId.set(parent.id, parent as ContactRow);
    }
    const admins = await loadAdminContacts(svc, me.id);
    for (const a of admins) byId.set(a.id, a);
    return freshJson({
      contacts: sortContacts(Array.from(byId.values())),
      _audit: AUDIT_TAG,
      _branch: 'agent',
      _adminCount: admins.length,
    });
  }

  if (me.role === 'researcher') {
    const byId = new Map<string, ContactRow>();
    if (me.referring_agent_id) {
      const { data: agent } = await svc
        .from('profiles')
        .select(SELECT)
        .eq('id', me.referring_agent_id)
        .eq('is_active', true)
        .maybeSingle();
      if (agent) byId.set(agent.id, agent as ContactRow);
    }
    // SACA: if the researcher was created by a sub-agent, expose that
    // sub-agent as a contact too — the researcher already had the
    // sub-agent as their salesperson when they signed up, so a messenger
    // conversation between them is the natural support channel.
    const meSubAgentTag = (me as { referring_sub_agent_id?: string | null }).referring_sub_agent_id;
    if (meSubAgentTag) {
      const { data: subAgent } = await svc
        .from('profiles')
        .select(SELECT)
        .eq('id', meSubAgentTag)
        .eq('is_active', true)
        .maybeSingle();
      if (subAgent) byId.set(subAgent.id, subAgent as ContactRow);
    }
    const admins = await loadAdminContacts(svc, me.id);
    for (const a of admins) byId.set(a.id, a);
    return freshJson({
      contacts: sortContacts(Array.from(byId.values())),
      _audit: AUDIT_TAG,
      _branch: 'researcher',
      _adminCount: admins.length,
    });
  }

  // Unknown role (e.g. shipping) -- still expose the platform admin(s) so the
  // caller is not entirely contactless.
  const admins = await loadAdminContacts(svc, me.id);
  return freshJson({
    contacts: sortContacts(admins),
    _audit: AUDIT_TAG,
    _branch: 'fallback',
    _role: String(me.role ?? 'unknown'),
    _adminCount: admins.length,
  });
}
