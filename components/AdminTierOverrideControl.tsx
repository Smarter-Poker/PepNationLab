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
  const [currentLevel, setCurrentLevel] = useState<number | null>(null);
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
        if (json.currentLevel) setCurrentLevel(Number(json.currentLevel));
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
      
      if (resolvedMarkup !== '' && resolvedMarkup !== null) {
        toast.success(`Flat Markup Set To ${resolvedMarkup}%`);
      } else {
        toast.success(nextEnabled ? `Locked To ${LEVELS.find((l) => l.level === nextLevel)?.name ?? `Level ${nextLevel}`}` : 'Switched To Gamification Scale');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed To Save Override');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  let selectValue = 'auto';
  if (customMarkup !== '' && customMarkup !== null) {
    selectValue = 'custom';
  } else if (enabled) {
    selectValue = `tier_${level}`;
  }

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'auto') {
      save(false, level, '');
      setCustomMarkup('');
    } else if (val.startsWith('tier_')) {
      const newLevel = Number(val.split('_')[1]);
      setLevel(newLevel);
      save(true, newLevel, '');
      setCustomMarkup('');
    } else if (val === 'custom') {
      // Don't save immediately, let the user type in the input box
      setCustomMarkup('0');
    }
  };

  const currentTierName = currentLevel ? LEVELS.find(l => l.level === currentLevel)?.name : null;
  const autoLabel = currentTierName
    ? `Gamification Scale (Currently Tier ${currentLevel}: ${currentTierName})`
    : 'Gamification Scale (Volume-Based)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
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
            flex: 1,
            minWidth: 200,
            maxWidth: '300px'
          }}
        >
          <option value="auto">{autoLabel}</option>
          
          <optgroup label="Lock To A Gamification Tier">
            {LEVELS.map((l) => (
              <option key={`tier_${l.level}`} value={`tier_${l.level}`}>
                Tier {l.level}: {l.name} ({[1.5, 2.0, 2.5][l.level - 1] * 100}% Markup)
              </option>
            ))}
          </optgroup>

          <option value="custom">Flat Markup (Custom %)...</option>
        </select>
        
        {selectValue === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ position: 'relative', width: 90 }}>
              <input
                type="number"
                min="0"
                max="500"
                value={customMarkup}
                onChange={(e) => setCustomMarkup(e.target.value)}
                onBlur={() => {
                  if (customMarkup !== '') {
                    save(false, level, customMarkup);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customMarkup !== '') {
                    save(false, level, customMarkup);
                  }
                }}
                disabled={saving}
                style={{
                  width: '100%',
                  background: 'var(--surface-3)',
                  border: '1px solid var(--teal)',
                  color: 'var(--white)',
                  borderRadius: 6,
                  padding: '6px 24px 6px 12px',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--silver)', fontSize: '0.85rem', pointerEvents: 'none' }}>%</span>
            </div>
            <button 
              type="button" 
              className="btn btn-primary btn-sm" 
              disabled={saving || customMarkup === ''} 
              onClick={() => save(false, level, customMarkup)}
              style={{ height: 32 }}
            >
              Apply
            </button>
          </div>
        )}
      </div>
      {!ladderActive && (
        <span style={{ fontSize: '0.65rem', color: 'var(--grey-500)', marginTop: 4 }}>Volume Based Pricing Takes Effect When Tier Ladder Is Enabled</span>
      )}
    </div>
  );
}
