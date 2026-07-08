import { createAdminClient } from '@/lib/supabase/server';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Downline Tree Builder
 *
 * Shared By The Admin Downline API (/api/admin/agents/downline - Any Root)
 * And The Super Agent Downline API (/api/agent/downline - Own Root Only).
 *
 * Hierarchy Model (Enforced By Database Triggers):
 *   Super Agent  - is_super_agent = true OR role = 'super_agent'. Top Level.
 *   Agent        - role = 'agent', Optionally parent_agent_id -> A Super Agent.
 *   Sub-Agent    - is_sub_agent = true, parent_agent_id -> A Regular Agent.
 *                  Sub-Agents Can Never Nest (Trigger Enforced).
 *   Researcher   - role = 'researcher', referring_agent_id -> Owning Agent
 *                  (Any Level, Including The House Store Or A Super Agent).
 */

export interface DownlineResearcher {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string | null;
}

export interface DownlineNode {
  id: string;
  username: string | null;
  full_name: string | null;
  role: string;
  is_super_agent: boolean;
  is_sub_agent: boolean;
  is_active: boolean;
  slug: string | null;
  display_name: string | null;
  researchers: DownlineResearcher[];
  children: DownlineNode[];
}

const AGENT_COLUMNS =
  'id, username, full_name, role, is_super_agent, is_sub_agent, is_active, parent_agent_id';

/**
 * Builds The Full Downline Tree Rooted At rootId. Traverses parent_agent_id
 * Levels Breadth-First (Bounded Depth - The Trigger-Enforced Hierarchy Is At
 * Most Super Agent -> Agent -> Sub-Agent), Then Attaches Every Researcher
 * Owned By Any Node In One Batched Query.
 */
export async function buildDownlineTree(
  admin: AdminClient,
  rootId: string,
): Promise<DownlineNode | null> {
  const { data: rootRow } = await admin
    .from('profiles')
    .select(AGENT_COLUMNS)
    .eq('id', rootId)
    .in('role', ['agent', 'super_agent'])
    .maybeSingle();
  if (!rootRow) return null;

  type Row = typeof rootRow;
  const byId = new Map<string, Row>([[rootRow.id, rootRow]]);
  const childIds = new Map<string, string[]>();

  // Bounded BFS: the schema allows at most three tiers, but walk up to four
  // levels defensively so nothing is silently hidden if data drifts.
  let frontier = [rootRow.id];
  for (let depth = 0; depth < 4 && frontier.length > 0; depth++) {
    const { data: kids } = await admin
      .from('profiles')
      .select(AGENT_COLUMNS)
      .in('parent_agent_id', frontier)
      .in('role', ['agent', 'super_agent']);
    const next: string[] = [];
    for (const k of kids ?? []) {
      if (byId.has(k.id)) continue; // Cycle Guard
      byId.set(k.id, k);
      const list = childIds.get(k.parent_agent_id as string) ?? [];
      list.push(k.id);
      childIds.set(k.parent_agent_id as string, list);
      next.push(k.id);
    }
    frontier = next;
  }

  const allIds = Array.from(byId.keys());

  // Storefront Labels For Every Node.
  const { data: storefronts } = await admin
    .from('agent_profiles')
    .select('id, slug, display_name')
    .in('id', allIds);
  const sfMap = new Map(
    (storefronts ?? []).map((s) => [String(s.id), { slug: s.slug ?? null, display_name: s.display_name ?? null }]),
  );

  // Every Researcher Owned By Any Node, One Query.
  const { data: researchers } = await admin
    .from('profiles')
    .select('id, username, full_name, email, is_active, created_at, referring_agent_id')
    .eq('role', 'researcher')
    .in('referring_agent_id', allIds)
    .order('created_at', { ascending: false });
  const researcherMap = new Map<string, DownlineResearcher[]>();
  for (const r of researchers ?? []) {
    const owner = String(r.referring_agent_id);
    const list = researcherMap.get(owner) ?? [];
    list.push({
      id: r.id,
      username: r.username ?? null,
      full_name: r.full_name ?? null,
      email: r.email && !String(r.email).includes('@internal.auth') ? r.email : null,
      is_active: r.is_active !== false,
      created_at: r.created_at ?? null,
    });
    researcherMap.set(owner, list);
  }

  const toNode = (id: string): DownlineNode => {
    const row = byId.get(id)!;
    const sf = sfMap.get(id);
    return {
      id: row.id,
      username: row.username ?? null,
      full_name: row.full_name ?? null,
      role: row.role,
      is_super_agent: row.is_super_agent === true || row.role === 'super_agent',
      is_sub_agent: row.is_sub_agent === true,
      is_active: row.is_active !== false,
      slug: sf?.slug ?? null,
      display_name: sf?.display_name ?? null,
      researchers: researcherMap.get(id) ?? [],
      children: (childIds.get(id) ?? []).map(toNode),
    };
  };

  return toNode(rootRow.id);
}

/** Flat List Of Every Agent Id In A Tree (Root Included). */
export function collectAgentIds(node: DownlineNode): string[] {
  return [node.id, ...node.children.flatMap(collectAgentIds)];
}
