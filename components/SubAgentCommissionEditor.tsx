'use client';

import { useState } from 'react';
import { toast } from 'sonner';

interface Step { min_volume: number; bonus_pct: number; }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  background: 'linear-gradient(180deg, #0b0f16 0%, #121822 100%)',
  border: '1px solid rgba(0,0,0,0.8)', color: 'var(--white)', borderRadius: 6,
};

/**
 * Per-sub-agent commission + velocity editor for a super-agent.
 * Self-contained: renders its own trigger button and modal, loads current state
 * on open, and posts to /api/agent/super-agent/commission-plan. Blind by design
 * — the super-agent's own House wholesale tier is never referenced.
 */
export default function SubAgentCommissionEditor({ subAgentId, name }: { subAgentId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [basePct, setBasePct] = useState('');
  const [capPct, setCapPct] = useState('');
  const [velocityCap, setVelocityCap] = useState('');
  const [steps, setSteps] = useState<Step[]>([]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/agent/super-agent/commission-plan?subAgentId=${encodeURIComponent(subAgentId)}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Load Plan');
      setBasePct(json.base_pct != null ? String(json.base_pct) : '0');
      setCapPct(json.cap_pct != null ? String(json.cap_pct) : '');
      setVelocityCap(json.velocity_cap != null ? String(json.velocity_cap) : '');
      setSteps(Array.isArray(json.steps) ? json.steps.map((s: Step) => ({ min_volume: Number(s.min_volume), bonus_pct: Number(s.bonus_pct) })) : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed To Load Plan');
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  function openModal() { setOpen(true); load(); }

  function updateStep(i: number, key: keyof Step, value: string) {
    setSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, [key]: Number(value) } : s));
  }
  function addStep() { setSteps((prev) => [...prev, { min_volume: 0, bonus_pct: 0 }]); }
  function removeStep(i: number) { setSteps((prev) => prev.filter((_, idx) => idx !== i)); }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/agent/super-agent/commission-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subAgentId,
          basePct: basePct === '' ? 0 : Number(basePct),
          capPct: capPct === '' ? null : Number(capPct),
          velocityCap: velocityCap === '' ? null : Number(velocityCap),
          steps: steps.map((s) => ({ min_volume: Number(s.min_volume), bonus_pct: Number(s.bonus_pct) })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Save');
      toast.success('Commission Plan Saved');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed To Save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" className="btn-silver" onClick={openModal}>Commission Plan</button>

      {open && (
        <div
          onClick={() => !saving && setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}
        >
          <div onClick={(e) => e.stopPropagation()} className="metal-frame" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
              <h3 className="metal-text" style={{ marginTop: 0, marginBottom: 4, fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Commission Plan
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4)' }}>
                For <strong style={{ color: 'var(--white)' }}>{name}</strong>. Set Their Base Rate, Optional Max Cap, Velocity Cap, And Performance-Bonus Milestones.
              </p>

              {loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--silver)' }}>Loading...</div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
                    <div style={{ flex: '1 1 140px' }}>
                      <label style={{ display: 'block', marginBottom: 6, color: 'var(--grey-300)', fontSize: '0.8rem' }}>Base Commission %</label>
                      <input type="number" style={inputStyle} value={basePct} onChange={(e) => setBasePct(e.target.value)} min="0" max="100" step="0.5" placeholder="0" />
                    </div>
                    <div style={{ flex: '1 1 140px' }}>
                      <label style={{ display: 'block', marginBottom: 6, color: 'var(--grey-300)', fontSize: '0.8rem' }}>Max Cap % (Optional)</label>
                      <input type="number" style={inputStyle} value={capPct} onChange={(e) => setCapPct(e.target.value)} min="0" max="100" step="0.5" placeholder="No Cap" />
                    </div>
                    <div style={{ flex: '1 1 140px' }}>
                      <label style={{ display: 'block', marginBottom: 6, color: 'var(--grey-300)', fontSize: '0.8rem' }}>Velocity Cap $ (Optional)</label>
                      <input type="number" style={inputStyle} value={velocityCap} onChange={(e) => setVelocityCap(e.target.value)} min="0" step="1" placeholder="No Limit" />
                    </div>
                  </div>

                  <div style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--white)' }}>Performance Bonus Milestones</span>
                    <button type="button" className="btn-silver" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={addStep}>Add Milestone</button>
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--grey-400)', marginBottom: 'var(--space-3)' }}>
                    When Monthly Retail Reaches A Milestone, The Bonus Is Added To The Base Rate (Capped At Max).
                  </p>

                  {steps.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)', padding: 'var(--space-3)', textAlign: 'center' }}>No Milestones. Add One Or Leave Empty To Use The House Default.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                      {steps.map((s, i) => (
                        <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', minWidth: 70 }}>At Retail $</span>
                          <input type="number" style={{ ...inputStyle, flex: 1 }} value={String(s.min_volume)} onChange={(e) => updateStep(i, 'min_volume', e.target.value)} min="0" step="100" />
                          <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', minWidth: 60 }}>Bonus %</span>
                          <input type="number" style={{ ...inputStyle, flex: 1 }} value={String(s.bonus_pct)} onChange={(e) => updateStep(i, 'bonus_pct', e.target.value)} min="0" max="100" step="0.5" />
                          <button type="button" className="btn-neon-red" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => removeStep(i)}>Remove</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
                    <button type="button" className="btn-silver" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
                    <button type="button" className="btn-neon-cyan" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Plan'}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
