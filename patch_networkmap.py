#!/usr/bin/env python3
"""Network Map upgrades: (1) cards open the agent's detail drawer, (2) each card
shows how many agents + researchers sit under that agent, (3) the misleading
"% Rate" (which is actually commission_pct / the super's markup) is relabelled
"% Markup". Assertion-guarded: every anchor must occur exactly once."""
import sys, os

ROOT = sys.argv[1]

ROUTE = os.path.join(ROOT, "app/api/agent/sub-agents/network/route.ts")
COMP = os.path.join(ROOT, "components/AgentNetworkMap.tsx")

# ---- API: add per-node agent_count + researcher_count ----------------------
A1_OLD = """    // Batched: orders for all sub-agents, pending commission ledger, storefront slugs.
    const [ordersRes, ledgerRes, profilesRes] = await Promise.all([
      subIds.length
        ? svc.from('orders').select('agent_id, total, status').in('agent_id', subIds)
        : Promise.resolve({ data: [] as Array<{ agent_id: string; total: number; status: string }> }),
      subIds.length
        ? svc.from('sub_agent_commission_ledger').select('sub_agent_id, commission_amount').in('sub_agent_id', subIds).eq('status', 'pending')
        : Promise.resolve({ data: [] as Array<{ sub_agent_id: string; commission_amount: number }> }),
      subIds.length
        ? svc.from('agent_profiles').select('id, slug, display_name').in('id', subIds)
        : Promise.resolve({ data: [] as Array<{ id: string; slug: string; display_name: string }> }),
    ]);"""

A1_NEW = """    // Batched: orders for all sub-agents, pending commission ledger, storefront
    // slugs, plus each node's own downline (agents + researchers under it).
    const [ordersRes, ledgerRes, profilesRes, childAgentsRes, childResearchersRes] = await Promise.all([
      subIds.length
        ? svc.from('orders').select('agent_id, total, status').in('agent_id', subIds)
        : Promise.resolve({ data: [] as Array<{ agent_id: string; total: number; status: string }> }),
      subIds.length
        ? svc.from('sub_agent_commission_ledger').select('sub_agent_id, commission_amount').in('sub_agent_id', subIds).eq('status', 'pending')
        : Promise.resolve({ data: [] as Array<{ sub_agent_id: string; commission_amount: number }> }),
      subIds.length
        ? svc.from('agent_profiles').select('id, slug, display_name').in('id', subIds)
        : Promise.resolve({ data: [] as Array<{ id: string; slug: string; display_name: string }> }),
      subIds.length
        ? svc.from('profiles').select('parent_agent_id').in('parent_agent_id', subIds).in('role', ['agent', 'super_agent'])
        : Promise.resolve({ data: [] as Array<{ parent_agent_id: string }> }),
      subIds.length
        ? svc.from('profiles').select('referring_agent_id').in('referring_agent_id', subIds).eq('role', 'researcher')
        : Promise.resolve({ data: [] as Array<{ referring_agent_id: string }> }),
    ]);"""

A2_OLD = """    const slugBySub = new Map<string, string>();
    for (const p of (profilesRes.data ?? []) as Array<{ id: string; slug: string }>) {
      slugBySub.set(p.id, p.slug);
    }"""

A2_NEW = """    const slugBySub = new Map<string, string>();
    for (const p of (profilesRes.data ?? []) as Array<{ id: string; slug: string }>) {
      slugBySub.set(p.id, p.slug);
    }

    // How many agents + researchers sit under each node (their own downline).
    const agentCountBySub = new Map<string, number>();
    for (const c of (childAgentsRes.data ?? []) as Array<{ parent_agent_id: string }>) {
      agentCountBySub.set(c.parent_agent_id, (agentCountBySub.get(c.parent_agent_id) ?? 0) + 1);
    }
    const researcherCountBySub = new Map<string, number>();
    for (const c of (childResearchersRes.data ?? []) as Array<{ referring_agent_id: string }>) {
      researcherCountBySub.set(c.referring_agent_id, (researcherCountBySub.get(c.referring_agent_id) ?? 0) + 1);
    }"""

A3_OLD = """        revenue,
        order_count: orderCount,
        pending_commission: pending,
      };
    });"""

A3_NEW = """        revenue,
        order_count: orderCount,
        pending_commission: pending,
        agent_count: agentCountBySub.get(id) ?? 0,
        researcher_count: researcherCountBySub.get(id) ?? 0,
      };
    });"""

# ---- Component -------------------------------------------------------------
C1_OLD = """import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';"""

C1_NEW = """import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import AgentAccountDetail from '@/components/AgentAccountDetail';"""

C2_OLD = """  revenue: number;
  order_count: number;
  pending_commission: number;
}"""

C2_NEW = """  revenue: number;
  order_count: number;
  pending_commission: number;
  agent_count: number;
  researcher_count: number;
}"""

C3_OLD = """  const [data, setData] = useState<NetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);"""

C3_NEW = """  const [data, setData] = useState<NetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<{ id: string; name: string } | null>(null);"""

C4_OLD = """                  <div style={{
                    width: '100%',
                    background: 'var(--surface-2, #162230)',
                    border: isTop ? '1.5px solid var(--teal)' : '1px solid rgba(192,184,168,0.15)',
                    borderRadius: 12,
                    padding: 'var(--space-4)',
                    boxShadow: isTop ? '0 0 18px rgba(0,196,188,0.2)' : 'none',
                    position: 'relative',
                  }}>"""

C4_NEW = """                  <div
                    role="button"
                    tabIndex={0}
                    title={`Open ${n.full_name || 'agent'}'s account`}
                    onClick={() => setSelectedAgent({ id: n.id, name: n.full_name || n.username || 'Agent' })}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedAgent({ id: n.id, name: n.full_name || n.username || 'Agent' }); } }}
                    style={{
                    width: '100%',
                    background: 'var(--surface-2, #162230)',
                    border: isTop ? '1.5px solid var(--teal)' : '1px solid rgba(192,184,168,0.15)',
                    borderRadius: 12,
                    padding: 'var(--space-4)',
                    boxShadow: isTop ? '0 0 18px rgba(0,196,188,0.2)' : 'none',
                    position: 'relative',
                    cursor: 'pointer',
                  }}>"""

C5_OLD = """                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--silver-light)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                      <span>{n.order_count} Orders</span>
                      <span>{n.commission_pct}% Rate</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--silver-light)', marginTop: 4 }}>
                      <span style={{ color: 'var(--grey-400)' }}>Pending</span>"""

C5_NEW = """                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--silver-light)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                      <span>{n.order_count} Orders</span>
                      <span>{n.commission_pct}% Markup</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--silver-light)', marginTop: 4 }}>
                      <span style={{ color: 'var(--grey-400)' }}>Downline</span>
                      <span style={{ color: 'var(--silver-light)' }}>
                        {n.agent_count} Agent{n.agent_count === 1 ? '' : 's'} &middot; {n.researcher_count} Researcher{n.researcher_count === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--silver-light)', marginTop: 4 }}>
                      <span style={{ color: 'var(--grey-400)' }}>Pending</span>"""

C6_OLD = """        </div>
      )}
    </div>
  );
}"""

C6_NEW = """        </div>
      )}

      {selectedAgent && (
        <AgentAccountDetail
          agentId={selectedAgent.id}
          agentName={selectedAgent.name}
          onClose={() => setSelectedAgent(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}"""

EDITS = [
    (ROUTE, A1_OLD, A1_NEW),
    (ROUTE, A2_OLD, A2_NEW),
    (ROUTE, A3_OLD, A3_NEW),
    (COMP, C1_OLD, C1_NEW),
    (COMP, C2_OLD, C2_NEW),
    (COMP, C3_OLD, C3_NEW),
    (COMP, C4_OLD, C4_NEW),
    (COMP, C5_OLD, C5_NEW),
    (COMP, C6_OLD, C6_NEW),
]

by_file = {}
for path, old, new in EDITS:
    by_file.setdefault(path, []).append((old, new))

for path, edits in by_file.items():
    if not os.path.isfile(path):
        print(f"ABORT: missing file {path}")
        sys.exit(2)
    s = open(path, encoding="utf-8").read()
    for i, (old, new) in enumerate(edits, 1):
        n = s.count(old)
        if n != 1:
            print(f"ABORT: {os.path.basename(path)} edit #{i}: anchor found {n} times (expected 1)")
            sys.exit(3)
        s = s.replace(old, new, 1)
    open(path, "w", encoding="utf-8").write(s)
    print(f"OK: patched {os.path.relpath(path, ROOT)} ({len(edits)} edits)")

print("PATCH_DONE")
