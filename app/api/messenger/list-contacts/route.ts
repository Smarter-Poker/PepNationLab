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
  is_super_agent?: boolean | null;
}

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

async function loadAdminContacts(
  svc: ReturnType<typeof createServiceClient> extends Promise<infer T> ? T : never,
  excludeId: string,
): Promise<ContactRow[]> {
  const { data, error } = await svc
    .from('profiles')
    .select('id, full_name, username, email, role, is_super_agent')
    .eq('role', 'admin')
    .eq('is_active', true)
    .neq('id', excludeId)
    .limit(50);
  if (error) {
    console.error('[list-contacts] loadAdminContacts failed', error);
    return [];
  }
  return (data ?? []) as ContactRow[];
}

function freshJson(body: unknown): NextResponse {
  const res = NextResponse.json(body);
  res.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return res;
}

const AUDIT_TAG = 'fix46';

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
    .select('id, role, parent_agent_id, referring_agent_id, is_sub_agent, referring_sub_agent_id, is_super_agent')
    .eq('id', user.id)
    .maybeSingle();

  if (!me) return freshJson({ contacts: [], _audit: AUDIT_TAG, _branch: 'no_profile' });

  // fix-46: include is_super_agent so the picker can distinguish super-agents
  // (who share role='agent' in the DB) from regular agents.
  const SELECT = 'id, full_name, username, email, role, is_super_agent';
  const selectActive = (q: ReturnType<typeof svc.from>) => q.select(SELECT).eq('is_active', true).neq('id', me.id); // @ts-ignore

  if (me.role === 'admin') {
    const { data } = await selectActive(svc.from('profiles')).limit(200); // @ts-ignore
    return freshJson({
      contacts: sortContacts((data ?? []) as ContactRow[]), // @ts-ignore
      _audit: AUDIT_TAG,
      _branch: 'admin',
    });
  }

  const isSuperAgent = me.role === 'super_agent' || (me as { is_super_agent?: boolean }).is_super_agent === true;
  if (isSuperAgent) {
    const { data: directDownline } = await selectActive(svc.from('profiles')) // @ts-ignore
      .eq('parent_agent_id', me.id) // @ts-ignore
      .limit(200);
    const downlineRows = (directDownline ?? []) as ContactRow[]; // @ts-ignore
    const directAgentIds = downlineRows.map((r) => r.id);

    let indirectSubAgents: ContactRow[] = [];
    if (directAgentIds.length > 0) {
      const { data: indirect } = await selectActive(svc.from('profiles')) // @ts-ignore
        .in('parent_agent_id', directAgentIds)
        .limit(200);
      indirectSubAgents = (indirect ?? []) as ContactRow[]; // @ts-ignore
    }

    const allAgentOrSubIds = [me.id, ...directAgentIds, ...indirectSubAgents.map((r) => r.id)];

    let researcherRows: ContactRow[] = [];
    if (allAgentOrSubIds.length > 0) {
      const { data: res1 } = await selectActive(svc.from('profiles')) // @ts-ignore
        .in('referring_agent_id', allAgentOrSubIds)
        .limit(500);
      const { data: res2 } = await selectActive(svc.from('profiles')) // @ts-ignore
        .in('referring_sub_agent_id', allAgentOrSubIds)
        .limit(500);
      researcherRows = [...((res1 ?? []) as ContactRow[]), ...((res2 ?? []) as ContactRow[])]; // @ts-ignore
    }
    const admins = await loadAdminContacts(svc, me.id);
    const byId = new Map<string, ContactRow>();
    for (const r of [...downlineRows, ...indirectSubAgents, ...researcherRows, ...admins]) byId.set(r.id, r);
    return freshJson({
      contacts: sortContacts(Array.from(byId.values())),
      _audit: AUDIT_TAG,
      _branch: 'super_agent',
      _adminCount: admins.length,
    });
  }

  if (me.role === 'agent') {
    const meIsSubAgent = (me as { is_sub_agent?: boolean | null }).is_sub_agent === true;
    const researcherQuery = meIsSubAgent
      ? selectActive(svc.from('profiles')).eq('referring_sub_agent_id', me.id) // @ts-ignore
      : selectActive(svc.from('profiles')).eq('referring_agent_id', me.id); // @ts-ignore
    const { data: researchers } = await researcherQuery.limit(500);
    const { data: subAgents } = await selectActive(svc.from('profiles')) // @ts-ignore
      .eq('parent_agent_id', me.id) // @ts-ignore
      .limit(200);
    const byId = new Map<string, ContactRow>();
    for (const r of [...(researchers ?? []), ...(subAgents ?? [])] as ContactRow[]) byId.set(r.id, r); // @ts-ignore
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

  const admins = await loadAdminContacts(svc, me.id);
  return freshJson({
    contacts: sortContacts(admins),
    _audit: AUDIT_TAG,
    _branch: 'fallback',
    _role: String(me.role ?? 'unknown'),
    _adminCount: admins.length,
  });
}
