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
// the caller (defense in depth -- the caller cannot be in this set anyway
// because the caller is non-admin in every branch that uses this helper).
async function loadAdminContacts(
  svc: ReturnType<typeof createServiceClient> extends Promise<infer T> ? T : never,
  excludeId: string,
): Promise<ContactRow[]> {
  const { data } = await svc
    .from('profiles')
    .select('id, full_name, username, email, role')
    .eq('role', 'admin')
    .eq('is_active', true)
    .neq('id', excludeId)
    .limit(50);
  return (data ?? []) as ContactRow[];
}

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
    .select('id, role, parent_agent_id, referring_agent_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!me) return NextResponse.json({ contacts: [] });

  const SELECT = 'id, full_name, username, email, role';
  const selectActive = (q: ReturnType<typeof svc.from>) => q.select(SELECT).eq('is_active', true).neq('id', me.id);

  if (me.role === 'admin') {
    const { data } = await selectActive(svc.from('profiles')).limit(200);
    return NextResponse.json({ contacts: sortContacts((data ?? []) as ContactRow[]) });
  }

  if (me.role === 'super_agent') {
    // Step 1: my agents (parent_agent_id = me) AND my sub-agents (also parent_agent_id = me).
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
    // Audit12: always include platform admin(s).
    const admins = await loadAdminContacts(svc, me.id);
    const byId = new Map<string, ContactRow>();
    for (const r of [...downlineRows, ...researcherRows, ...admins]) byId.set(r.id, r);
    return NextResponse.json({ contacts: sortContacts(Array.from(byId.values())) });
  }

  if (me.role === 'agent') {
    const { data: researchers } = await selectActive(svc.from('profiles'))
      .eq('referring_agent_id', me.id)
      .limit(500);
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
    // Audit12: always include platform admin(s).
    const admins = await loadAdminContacts(svc, me.id);
    for (const a of admins) byId.set(a.id, a);
    return NextResponse.json({ contacts: sortContacts(Array.from(byId.values())) });
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
    // Audit12: researchers always get the admin(s) as a contact even if the
    // referring_agent_id is NULL (deactivated upstream agent) -- so they can
    // always reach platform support.
    const admins = await loadAdminContacts(svc, me.id);
    for (const a of admins) byId.set(a.id, a);
    return NextResponse.json({ contacts: sortContacts(Array.from(byId.values())) });
  }

  // Unknown role -- still expose the platform admin(s) so the caller is
  // not entirely contactless. (Defensive; the production role enum is
  // admin/super_agent/agent/researcher/shipping.)
  const admins = await loadAdminContacts(svc, me.id);
  return NextResponse.json({ contacts: sortContacts(admins) });
}
