'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format((Number(cents) || 0) / 100);

export default function GoalTracker({ revenueCents }: { revenueCents: number }) {
  const [goal, setGoal] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState('');

  async function load() {
    const r = await fetch('/api/agent/sales/goal', { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json();
      setGoal(j.goal);
      if (j.goal) setTarget(String(j.goal.target_cents / 100));
    }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    const tc = Math.round(parseFloat(target) * 100);
    if (!tc || tc <= 0) return toast.error('Invalid Target');
    const r = await fetch('/api/agent/sales/goal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_cents: tc }),
    });
    if (r.ok) { toast.success('Goal Saved'); setEditing(false); load(); }
    else toast.error('Save Failed');
  }

  const target_cents = Number(goal?.target_cents ?? 0);
  const pct = target_cents > 0 ? Math.min(100, Math.round((revenueCents / target_cents) * 100)) : 0;

  return (
    <div className="metal-frame">
      <div className="metal-content" style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ color: 'var(--white)', fontSize: '0.95rem', margin: 0 }}>Monthly Goal</h3>
          <button onClick={() => setEditing(v => !v)} style={{
            background: 'rgba(255,255,255,0.05)', color: 'var(--white)', border: '1px solid rgba(255,255,255,0.1)',
            padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
          }}>{editing ? 'Cancel' : (goal ? 'Edit' : 'Set Goal')}</button>
        </div>

        {editing ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" min="1" step="1" value={target} onChange={e => setTarget(e.target.value)}
              placeholder="Monthly Target USD"
              style={{
                flex: 1, padding: 10, borderRadius: 8, fontSize: '16px',
                background: 'rgba(255,255,255,0.04)', color: 'var(--white)',
                border: '1px solid rgba(255,255,255,0.1)',
              }} />
            <button onClick={save} style={{
              background: 'var(--teal)', color: 'var(--black)', border: 'none',
              padding: '10px 16px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', minHeight: 44,
            }}>Save</button>
          </div>
        ) : goal ? (
          <>
            <div style={{ height: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--teal)', transition: 'width 0.3s' }} />
            </div>
            <div style={{ color: 'var(--grey-300)', fontSize: '0.85rem', marginTop: 6 }}>
              {money(revenueCents)} Of {money(target_cents)} — {pct}%
            </div>
          </>
        ) : (
          <p style={{ color: 'var(--grey-500)', fontSize: '0.85rem', margin: 0 }}>No Goal Set For This Month.</p>
        )}
      </div>
    </div>
  );
}
