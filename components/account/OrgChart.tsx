'use client';

import { useEffect, useState } from 'react';

export default function OrgChart() {
  const [nodes, setNodes] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/agent/team/org-chart', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => j && setNodes(j.nodes ?? []));
  }, []);

  if (nodes.length <= 1) return null;

  const rootId = nodes.find(n => n.depth === 0)?.id;
  const byParent: Record<string, any[]> = {};
  nodes.forEach(n => {
    if (!n.parent_id) return;
    (byParent[n.parent_id] = byParent[n.parent_id] || []).push(n);
  });

  function Node({ id, depth }: { id: string; depth: number }) {
    const node = nodes.find(n => n.id === id);
    if (!node) return null;
    const children = byParent[id] ?? [];
    return (
      <li style={{ marginLeft: depth * 14, listStyle: 'none', padding: '6px 0' }}>
        <div style={{
          display: 'inline-block', padding: '6px 12px', borderRadius: 8,
          background: depth === 0 ? 'var(--teal)' : 'rgba(255,255,255,0.04)',
          color: depth === 0 ? 'var(--black)' : 'var(--white)',
          fontWeight: 700, fontSize: '0.85rem',
        }}>
          {node.full_name ?? node.username ?? '—'}
          <span style={{ color: depth === 0 ? '#000a' : 'var(--grey-500)', fontWeight: 500, marginLeft: 8, fontSize: '0.72rem' }}>
            {node.role}
          </span>
        </div>
        {children.length > 0 && (
          <ul style={{ padding: 0, margin: 0 }}>
            {children.map(c => <Node key={c.id} id={c.id} depth={depth + 1} />)}
          </ul>
        )}
      </li>
    );
  }

  if (!rootId) return null;
  return (
    <section className="card-metal" style={{ padding: 16, borderRadius: 12 }}>
      <h3 style={{ color: 'var(--white)', marginTop: 0 }}>Team Org Chart</h3>
      <ul style={{ padding: 0, margin: 0 }}>
        <Node id={rootId} depth={0} />
      </ul>
    </section>
  );
}
