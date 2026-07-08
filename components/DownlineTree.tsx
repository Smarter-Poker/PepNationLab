'use client';

import { useCallback, useEffect, useState } from 'react';
import { Crown, Store, Users, User, ChevronDown, ChevronRight, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';

/**
 * DownlineTree - Shared Hierarchy Viewer + Move Tool
 *
 * mode = 'admin': Fetches /api/admin/agents/downline?rootId=... - Full Tree
 *   From Any Root. Admin Can Move Any Researcher To Any Agent Or Super Agent
 *   On The Platform, And Move Any Agent Under A Super Agent, Under A Regular
 *   Agent (Becoming A Sub-Agent), Or Make It Independent.
 *
 * mode = 'super': Fetches /api/agent/downline - The Caller's Own Tree.
 *   A Super Agent Can Move Researchers Only Between Accounts Inside Their
 *   Own Downline.
 */

interface Researcher {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  is_active: boolean;
}

interface TreeNode {
  id: string;
  username: string | null;
  full_name: string | null;
  role: string;
  is_super_agent: boolean;
  is_sub_agent: boolean;
  is_active: boolean;
  slug: string | null;
  display_name: string | null;
  researchers: Researcher[];
  children: TreeNode[];
}

interface OwnerOption {
  id: string;
  label: string;
  username?: string | null;
  is_super_agent: boolean;
  is_sub_agent?: boolean;
}

export default function DownlineTree({ mode, rootId }: { mode: 'admin' | 'super'; rootId?: string }) {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // moving = 'r:<researcherId>' Or 'a:<agentId>' Currently Showing A Move Picker.
  const [moving, setMoving] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const url = mode === 'admin'
        ? `/api/admin/agents/downline?rootId=${encodeURIComponent(rootId ?? '')}`
        : '/api/agent/downline';
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Failed To Load Downline');
        setTree(null);
        return;
      }
      setTree(json.tree ?? null);
      setOwners(mode === 'admin' ? (json.owners ?? []) : (json.targets ?? []));
    } catch {
      setError('Failed To Load Downline');
    } finally {
      setLoading(false);
    }
  }, [mode, rootId]);

  useEffect(() => { load(); }, [load]);

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const moveResearcher = async (researcherId: string, toAgentId: string) => {
    setSaving(true);
    try {
      const res = mode === 'admin'
        ? await fetch('/api/admin/researchers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: researcherId, action: 'assign_researcher', assign_to_agent_id: toAgentId }),
          })
        : await fetch('/api/agent/downline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reassign_researcher', researcher_id: researcherId, to_agent_id: toAgentId }),
          });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Failed To Move Researcher');
      } else {
        toast.success('Researcher Moved');
        setMoving(null);
        setMoveTarget('');
        await load();
      }
    } catch {
      toast.error('Failed To Move Researcher');
    } finally {
      setSaving(false);
    }
  };

  const moveAgent = async (agentId: string, newParentId: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/agents/downline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reassign_agent', agent_id: agentId, new_parent_id: newParentId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Failed To Move Agent');
      } else {
        toast.success('Agent Moved');
        setMoving(null);
        setMoveTarget('');
        await load();
      }
    } catch {
      toast.error('Failed To Move Agent');
    } finally {
      setSaving(false);
    }
  };

  const renderMovePicker = (
    key: string,
    options: Array<{ id: string; label: string }>,
    onConfirm: (targetId: string) => void,
  ) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
      <select
        className="form-input"
        style={{ margin: 0, maxWidth: 320, fontSize: '0.8rem', padding: '6px 10px' }}
        value={moving === key ? moveTarget : ''}
        onChange={(e) => setMoveTarget(e.target.value)}
        aria-label="Move To"
      >
        <option value="">Select New Owner...</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      <button
        type="button"
        className="btn-neon-cyan"
        style={{ padding: '6px 14px', fontSize: '0.78rem' }}
        disabled={saving || !moveTarget}
        onClick={() => moveTarget && onConfirm(moveTarget)}
      >
        {saving ? 'Moving...' : 'Confirm Move'}
      </button>
      <button
        type="button"
        className="btn-silver"
        style={{ padding: '6px 12px', fontSize: '0.78rem' }}
        onClick={() => { setMoving(null); setMoveTarget(''); }}
        disabled={saving}
      >
        Cancel
      </button>
    </div>
  );

  const researcherMoveOptions = (currentOwnerId: string) =>
    owners
      .filter((o) => o.id !== currentOwnerId)
      .map((o) => ({
        id: o.id,
        label: `${o.label}${o.is_super_agent ? ' (Super Agent)' : ''}`,
      }));

  const agentMoveOptions = (node: TreeNode) => {
    const opts = owners
      .filter((o) => o.id !== node.id && o.is_super_agent)
      .map((o) => ({ id: o.id, label: `${o.label} (Super Agent)` }));
    // Regular Agents Can Also Take Sub-Agents (Only If The Moving Agent Has
    // No Downline Of Its Own - The Server Enforces This Too).
    if (node.children.length === 0) {
      for (const o of owners) {
        if (o.id === node.id || o.is_super_agent || o.is_sub_agent) continue;
        opts.push({ id: o.id, label: `${o.label} (Becomes Sub-Agent)` });
      }
    }
    opts.push({ id: '__NONE__', label: 'Independent (No Parent)' });
    return opts;
  };

  const renderResearcher = (r: Researcher, ownerId: string, depth: number) => {
    const key = `r:${r.id}`;
    return (
      <div
        key={r.id}
        style={{
          marginLeft: depth * 22,
          padding: '8px 12px',
          borderLeft: '2px solid rgba(168,180,192,0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <User size={13} aria-hidden="true" style={{ color: 'var(--silver)', flexShrink: 0 }} />
          <span style={{ color: 'var(--white)', fontSize: '0.85rem', fontWeight: 500 }}>
            {r.full_name || r.username || 'Researcher'}
          </span>
          {r.username && (
            <span style={{ color: 'var(--grey-500)', fontSize: '0.75rem' }}>@{r.username}</span>
          )}
          {!r.is_active && (
            <span style={{ color: 'var(--red)', fontSize: '0.7rem', border: '1px solid var(--red)', borderRadius: 4, padding: '1px 6px' }}>
              Inactive
            </span>
          )}
          <button
            type="button"
            className="btn-silver"
            style={{ padding: '2px 10px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            onClick={() => { setMoving(moving === key ? null : key); setMoveTarget(''); }}
          >
            <ArrowRightLeft size={11} aria-hidden="true" />
            Move
          </button>
        </div>
        {moving === key && renderMovePicker(key, researcherMoveOptions(ownerId), (t) => moveResearcher(r.id, t))}
      </div>
    );
  };

  const renderNode = (node: TreeNode, depth: number, isRoot: boolean) => {
    const key = `a:${node.id}`;
    const isCollapsed = collapsed.has(node.id);
    const label = node.display_name || node.full_name || node.username || 'Agent';
    const badge = node.is_super_agent ? 'Super Agent' : node.is_sub_agent ? 'Sub-Agent' : 'Agent';
    const BadgeIcon = node.is_super_agent ? Crown : node.is_sub_agent ? Users : Store;
    const hasContents = node.children.length > 0 || node.researchers.length > 0;

    return (
      <div key={node.id} style={{ marginLeft: depth === 0 ? 0 : 22 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            padding: '10px 12px',
            marginTop: depth === 0 ? 0 : 6,
            background: isRoot ? 'rgba(0,196,188,0.06)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isRoot ? 'rgba(0,196,188,0.35)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => toggleCollapse(node.id)}
              aria-label={isCollapsed ? 'Expand' : 'Collapse'}
              style={{ background: 'none', border: 'none', cursor: hasContents ? 'pointer' : 'default', color: 'var(--silver)', padding: 0, display: 'flex' }}
              disabled={!hasContents}
            >
              {hasContents
                ? (isCollapsed ? <ChevronRight size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />)
                : <ChevronRight size={15} aria-hidden="true" style={{ opacity: 0.25 }} />}
            </button>
            <BadgeIcon size={14} aria-hidden="true" style={{ color: node.is_super_agent ? 'var(--teal)' : 'var(--silver)', flexShrink: 0 }} />
            <span style={{ color: 'var(--white)', fontWeight: 700, fontSize: '0.92rem' }}>{label}</span>
            {node.username && <span style={{ color: 'var(--grey-500)', fontSize: '0.76rem' }}>@{node.username}</span>}
            <span style={{
              fontSize: '0.68rem',
              color: node.is_super_agent ? 'var(--teal)' : 'var(--silver)',
              border: `1px solid ${node.is_super_agent ? 'var(--teal)' : 'rgba(168,180,192,0.4)'}`,
              borderRadius: 4,
              padding: '1px 7px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              {badge}
            </span>
            {!node.is_active && (
              <span style={{ color: 'var(--red)', fontSize: '0.7rem', border: '1px solid var(--red)', borderRadius: 4, padding: '1px 6px' }}>
                Inactive
              </span>
            )}
            <span style={{ color: 'var(--grey-500)', fontSize: '0.74rem' }}>
              {node.children.length > 0 && `${node.children.length} Agent${node.children.length === 1 ? '' : 's'} / `}
              {node.researchers.length} Researcher{node.researchers.length === 1 ? '' : 's'}
            </span>
            {mode === 'admin' && !isRoot && !node.is_super_agent && (
              <button
                type="button"
                className="btn-silver"
                style={{ padding: '2px 10px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={() => { setMoving(moving === key ? null : key); setMoveTarget(''); }}
              >
                <ArrowRightLeft size={11} aria-hidden="true" />
                Move Agent
              </button>
            )}
          </div>
          {mode === 'admin' && moving === key && renderMovePicker(key, agentMoveOptions(node), (t) => moveAgent(node.id, t))}
        </div>

        {!isCollapsed && (
          <div>
            {node.researchers.map((r) => renderResearcher(r, node.id, 1))}
            {node.children.map((c) => renderNode(c, depth + 1, false))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <p style={{ color: 'var(--silver)', fontSize: '0.9rem', padding: 'var(--space-4)' }}>Loading Downline...</p>;
  }
  if (error) {
    return <p style={{ color: 'var(--red)', fontSize: '0.9rem', padding: 'var(--space-4)' }}>{error}</p>;
  }
  if (!tree) {
    return <p style={{ color: 'var(--silver)', fontSize: '0.9rem', padding: 'var(--space-4)' }}>No Downline Data</p>;
  }

  return (
    <div>
      <p style={{ color: 'var(--silver)', fontSize: '0.8rem', marginBottom: 'var(--space-3)' }}>
        {mode === 'admin'
          ? 'Move Any Researcher To Any Agent Or Super Agent, Or Move An Agent Under A Different Super Agent.'
          : 'Move Researchers Between Accounts Inside Your Downline.'}
      </p>
      {renderNode(tree, 0, true)}
    </div>
  );
}
