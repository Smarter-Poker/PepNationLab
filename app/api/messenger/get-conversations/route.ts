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
 * round-22: admin sees a HIERARCHICAL conversation list, not a flat
 * dump of every account.
 *
 *   - Default (no parentId in the request body): only conversations
 *     with admin's direct downline — top-level agents/super_agents
 *     (parent_agent_id IS NULL) plus any researcher the admin
 *     specifically referred (referring_agent_id = admin.id).
 *   - parentId in the body: drill in. Conversations with that user's
 *     direct downline (parent_agent_id = parentId OR
 *     referring_agent_id = parentId).
 *
 * Non-admin roles still see their full conversation list via the
 * existing fn_get_user_conversations RPC — only admin's view is
 * filtered to enforce the downline scope.
 */
async function getAdminDownlineIds(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  adminId: string,
  parentId: string | null,
): Promise<Set<string>> {
  const ids = new Set<string>();
  if (parentId) {
    // Drill-down: any profile whose parent OR referring agent is parentId
    const { data: byParent } = await svc
      .from('profiles')
      .select('id')
      .eq('parent_agent_id', parentId)
      .eq('is_active', true)
      .limit(500);
    for (const r of (byParent ?? []) as { id: string }[]) ids.add(r.id);

    const { data: byReferring } = await svc
      .from('profiles')
      .select('id')
      .eq('referring_agent_id', parentId)
      .eq('is_active', true)
      .limit(500);
    for (const r of (byReferring ?? []) as { id: string }[]) ids.add(r.id);
    return ids;
  }

  // Root: top-level agents (no parent) + admin-direct researchers.
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
    .eq('referring_agent_id', adminId)
    .eq('is_active', true)
    .limit(500);
  for (const r of (directResearchers ?? []) as { id: string }[]) ids.add(r.id);

  return ids;
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('read', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  // Parse optional parentId for drill-down. Tolerant of missing body /
  // non-json — falls back to no parentId.
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

  // Fetch the calling user's role so we know whether to apply the
  // admin downline filter or fall through to the standard RPC result.
  const { data: me } = await svc
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  const { data, error: rpcErr } = await svc.rpc('fn_get_user_conversations', { p_user: user.id });
  if (rpcErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  let conversations = (data ?? []) as RawConv[];

  if (me?.role === 'admin') {
    const downlineIds = await getAdminDownlineIds(svc, user.id, parentId);
    conversations = conversations.filter((c) => {
      const cp = c.counterparty_id;
      // Direct DMs only — keep when counterparty is in the downline set.
      return typeof cp === 'string' && downlineIds.has(cp);
    });
  }

  const res = NextResponse.json({
    conversations,
    _scope: me?.role === 'admin' ? (parentId ? 'admin_drill' : 'admin_root') : 'self',
    _parentId: parentId,
  });
  res.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return res;
}
