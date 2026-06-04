'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const LEVELS: { level: number; name: string }[] = [
  { level: 1, name: 'Premium' },
  { level: 2, name: 'Pro' },
  { level: 3, name: 'Rookie' },
];

/**
 * Admin "Fixed Scale Override" control for one agent. Locks the agent to a
 * specific House tier regardless of rolling volume (or releases back to
 * volume-driven). Self-contained: loads current state from GET and writes via
 * POST /api/admin/agents/tier-override. Only affects pricing once the tier
 * ladder feature flag is enabled.
 */
export default function AdminTierOverrideControl({ agentId }: { agentId: string }) {
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [level, setLevel] = useState(3);
  const [ladderActive, setLadderActive] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/agents/tier-override?agentId=${encodeURIComponent(agentId)}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'load failed');
        if (cancelled) return;
        setEnabled(!!json.enabled);
        if (json.level) setLevel(Number(json.level));
        setLadderActive(!!json.ladderActive);
      } catch {
        /* non-blocking: leave defaults */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [agentId]);

  async function save(nextEnabled: boolean, nextLevel: number) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/agents/tier-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, enabled: nextEnabled, level: nextEnabled ? nextLevel : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Save Override');
      setEnabled(nextEnabled);
      toast.success(nextEnabled ? `Locked To ${LEVELS.find((l) => l.level === nextLevel)?.name ?? `Level ${nextLevel}`}` : 'Override Released');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed To Save Override');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
      <span style={{ fontSize: '0.62rem', color: 'var(--grey-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>House Tier Lock</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => save(!enabled, level)}
          disabled={saving}
          style={{
            padding: '3px 10px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            background: enabled ? 'var(--teal)' : 'rgba(192,184,168,0.12)',
            color: enabled ? '#04221f' : 'var(--grey-400)',
            border: enabled ? '1px solid var(--teal)' : '1px solid rgba(192,184,168,0.3)',
          }}
        >
          {enabled ? 'Locked' : 'Auto'}
        </button>
        {enabled && (
          <select
            value={level}
            disabled={saving}
            onChange={(e) => { const lv = Number(e.target.value); setLevel(lv); save(true, lv); }}
            style={{ background: 'var(--surface-3)', color: 'var(--white)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '3px 6px', fontSize: '0.7rem', cursor: 'pointer' }}
          >
            {LEVELS.map((l) => <option key={l.level} value={l.level}>{l.name}</option>)}
          </select>
        )}
      </div>
      {!ladderActive && (
        <span style={{ fontSize: '0.6rem', color: 'var(--grey-500)' }}>Takes Effect When Tier Ladder Is Enabled</span>
      )}
    </div>
  );
}
