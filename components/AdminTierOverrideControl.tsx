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
  const [customMarkup, setCustomMarkup] = useState<string>('');
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
        if (json.customMarkup !== null && json.customMarkup !== undefined) {
          setCustomMarkup(String(json.customMarkup));
        } else {
          setCustomMarkup('');
        }
        setLadderActive(!!json.ladderActive);
      } catch {
        /* non-blocking: leave defaults */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [agentId]);

  async function save(nextEnabled: boolean, nextLevel: number, nextCustomMarkup?: string) {
    setSaving(true);
    const resolvedMarkup = nextCustomMarkup !== undefined ? nextCustomMarkup : customMarkup;
    try {
      const res = await fetch('/api/admin/agents/tier-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          agentId, 
          enabled: nextEnabled, 
          level: nextEnabled ? nextLevel : undefined,
          customMarkup: resolvedMarkup === '' ? null : Number(resolvedMarkup)
        }),
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

  let selectValue = 'auto';
  if (customMarkup !== '' && customMarkup !== null) {
    selectValue = `custom_${customMarkup}`;
  } else if (enabled) {
    selectValue = `tier_${level}`;
  }

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'auto') {
      save(false, level, '');
    } else if (val.startsWith('tier_')) {
      const newLevel = Number(val.split('_')[1]);
      setLevel(newLevel);
      save(true, newLevel, '');
    } else if (val.startsWith('custom_')) {
      const newCustom = val.split('_')[1];
      setCustomMarkup(newCustom);
      save(false, level, newCustom); // false for fixed_scale_override because custom overrides take precedence natively
    }
  };

  // Build custom options, ensuring the currently selected custom markup is present
  const baseCustomOptions = [10, 20, 30, 40];
  const currentCustomNumber = customMarkup !== '' ? Number(customMarkup) : null;
  const customOptions = [...baseCustomOptions];
  if (currentCustomNumber !== null && !customOptions.includes(currentCustomNumber)) {
    customOptions.push(currentCustomNumber);
    customOptions.sort((a, b) => a - b);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <select
          value={selectValue}
          disabled={saving}
          onChange={handleSelectChange}
          style={{ 
            background: 'var(--surface-3)', 
            color: 'var(--white)', 
            border: '1px solid rgba(255,255,255,0.15)', 
            borderRadius: 6, 
            padding: '6px 12px', 
            fontSize: '0.85rem', 
            cursor: saving ? 'not-allowed' : 'pointer',
            width: '100%',
            maxWidth: '300px'
          }}
        >
          <option value="auto">Auto (Volume Based)</option>
          
          <optgroup label="Gamification Tiers">
            {LEVELS.map((l) => (
              <option key={`tier_${l.level}`} value={`tier_${l.level}`}>
                Tier {l.level}: {l.name} ({[0.5, 0.6, 0.7][l.level - 1] * 100}% Markup)
              </option>
            ))}
          </optgroup>

          <optgroup label="Custom Pricing Override">
            {customOptions.map(pct => (
              <option key={`custom_${pct}`} value={`custom_${pct}`}>
                Custom: {pct}% Markup
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      {!ladderActive && (
        <span style={{ fontSize: '0.65rem', color: 'var(--grey-500)', marginTop: 4 }}>Volume Based Pricing Takes Effect When Tier Ladder Is Enabled</span>
      )}
    </div>
  );
}
