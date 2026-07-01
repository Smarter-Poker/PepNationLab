'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface ReparentablePerson {
  id: string;
  name: string;
}

/**
 * fix-57 #1: Reparent control. Two selects + button.
 * - First select: which agent to move
 * - Second select: new parent (or "Top Level (No Parent)")
 */
export default function ReparentControl({ people }: { people: ReparentablePerson[] }) {
  const router = useRouter();
  const [agentId, setAgentId] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId) { toast.error('Pick An Agent To Move'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/agents/reparent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          parentAgentId: parentId === '' ? null : parentId,
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Failed To Reparent'); return; }
      toast.success('Agent Reparented');
      setAgentId(''); setParentId('');
      router.refresh();
    } catch { toast.error('Network Error'); } finally { setBusy(false); }
  };

  return (
    <div className="glass-panel" style={{ marginBottom: 'var(--space-6)' }}>
      <div className="" style={{ padding: 'var(--space-5)' }}>
        <h3 style={{ fontSize: '0.95rem', margin: 0, marginBottom: 'var(--space-3)' }}>Reparent Agent</h3>
        <form onSubmit={submit} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220, flex: '1 1 220px' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--grey-400)', fontWeight: 700 }}>Agent To Move</span>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--surface-1)', border: '1px solid var(--surface-3)', color: 'var(--white)', fontSize: '0.88rem', outline: 'none' }}>
              <option value="">Select</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220, flex: '1 1 220px' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--grey-400)', fontWeight: 700 }}>New Parent</span>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--surface-1)', border: '1px solid var(--surface-3)', color: 'var(--white)', fontSize: '0.88rem', outline: 'none' }}>
              <option value="">Top Level (No Parent)</option>
              {people.map((p) => (
                <option key={p.id} value={p.id} disabled={p.id === agentId}>{p.name}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy || !agentId} className="btn-primary" style={{ opacity: busy || !agentId ? 0.5 : 1 }}>
            {busy ? 'Saving...' : 'Reparent'}
          </button>
        </form>
      </div>
    </div>
  );
}
