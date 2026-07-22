'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface TierLevel { level: number; name: string; markup?: number }

/**
 * Admin flat-markup control for one TOP-LEVEL agent.
 *
 * Owner request 2026-07-22: markup is set by MANUALLY typing a percentage - no
 * predetermined Tier 1/2/3 options and no volume "gamification" scale. The admin
 * types the % the agent pays over house cost and hits Apply. Writes customMarkup
 * (a flat percent) via POST /api/admin/agents/tier-override (enabled:false), the
 * same endpoint/column the old "Flat Markup (Custom %)" path already used, so no
 * server change is needed. When the agent currently has no explicit override, the
 * box is pre-filled with their current effective tier markup % so the admin sees
 * the live number and can adjust it directly.
 */
export default function AdminTierOverrideControl({ agentId }: { agentId: string }) {
  const [loaded, setLoaded] = useState(false);
  const [markup, setMarkup] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/agents/tier-override?agentId=${encodeURIComponent(agentId)}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'load failed');
        if (cancelled) return;
        if (json.customMarkup !== null && json.customMarkup !== undefined) {
          setMarkup(String(json.customMarkup));
        } else if (json.currentLevel && Array.isArray(json.levels)) {
          // No explicit override yet: pre-fill with the agent's current effective
          // tier markup % so the admin sees the live number and can change it.
          const lvl = (json.levels as TierLevel[]).find((l) => l.level === Number(json.currentLevel));
          setMarkup(lvl?.markup != null ? String(Math.round(lvl.markup * 100)) : '');
        } else {
          setMarkup('');
        }
      } catch {
        /* non-blocking: leave defaults */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [agentId]);

  async function save() {
    if (markup === '') {
      toast.error('Enter A Markup % (0-500).');
      return;
    }
    // Fail-closed client guard mirroring the server rule (finite, 0-500%).
    const markupNum = Number(markup);
    if (!Number.isFinite(markupNum) || markupNum < 0 || markupNum > 500) {
      toast.error('Markup Must Be A Number Between 0 And 500.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/agents/tier-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, enabled: false, customMarkup: markupNum }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Save Markup');
      toast.success(`Markup Set To ${markupNum}%`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed To Save Markup');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 120 }}>
          <input
            type="number"
            min="0"
            max="500"
            value={markup}
            onChange={(e) => setMarkup(e.target.value.replace(/[^0-9.]/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            disabled={saving}
            placeholder="100"
            style={{
              width: '100%',
              background: 'var(--surface-3)',
              border: '1px solid var(--teal)',
              color: 'var(--white)',
              borderRadius: 6,
              padding: '6px 24px 6px 12px',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--silver)', fontSize: '0.85rem', pointerEvents: 'none' }}>%</span>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={saving || markup === ''}
          onClick={save}
          style={{ height: 32 }}
        >
          {saving ? 'Saving...' : 'Apply Markup'}
        </button>
      </div>
      <span style={{ fontSize: '0.65rem', color: 'var(--grey-500)', marginTop: 2 }}>
        This Agent Pays House Cost Plus This Markup %. Type Any Number - No Preset Tiers.
      </span>
    </div>
  );
}
