'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface VariantStep {
  hours_after: number;
  subject: string;
  body: string;
  discount_pct?: number;
  free_shipping?: boolean;
}

interface Variant {
  id: string;
  name: string;
  enabled: boolean;
  steps: VariantStep[];
  sent: number;
  recovered: number;
  winRate: number;
}

export default function AdminCartRecoveryPage() {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSteps, setNewSteps] = useState('[\n  { "hours_after": 24, "subject": "You Left Items In Your Cart", "body": "Complete Your Checkout Today." }\n]');

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/cart-recovery-variants', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) { setErr(json.error || 'Failed To Load'); return; }
      setVariants(json.variants ?? []);
    } catch { setErr('Network Error'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleEnabled = async (v: Variant) => {
    try {
      const res = await fetch(`/api/admin/cart-recovery-variants?id=${encodeURIComponent(v.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !v.enabled }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); toast.error(j.error || 'Failed To Update'); return; }
      load();
    } catch { toast.error('Failed To Update'); }
  };

  const saveSteps = async (v: Variant) => {
    const raw = editing[v.id];
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) { toast.error('Steps Must Be A JSON Array'); return; }
      const res = await fetch(`/api/admin/cart-recovery-variants?id=${encodeURIComponent(v.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: parsed }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Failed To Save'); return; }
      toast.success('Variant Saved');
      const next = { ...editing }; delete next[v.id]; setEditing(next);
      load();
    } catch (e: any) {
      toast.error('Invalid JSON: ' + (e?.message || ''));
    }
  };

  const removeVariant = async (v: Variant) => {
    if (!confirm(`Delete Variant "${v.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/cart-recovery-variants?id=${encodeURIComponent(v.id)}`, { method: 'DELETE' });
      if (!res.ok) { const j = await res.json().catch(() => ({})); toast.error(j.error || 'Failed To Delete'); return; }
      load();
    } catch { toast.error('Failed To Delete'); }
  };

  const createVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(newSteps);
      const res = await fetch('/api/admin/cart-recovery-variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, steps: parsed, enabled: true }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Failed To Create'); return; }
      toast.success('Variant Created');
      setCreating(false); setNewName(''); setNewSteps('[]');
      load();
    } catch (e: any) {
      toast.error('Invalid JSON: ' + (e?.message || ''));
    }
  };

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 className="animated-gradient-text" style={{ fontSize: '1.6rem', margin: 0 }}>Cart Recovery Variants (A/B)</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginTop: 6, marginBottom: 0 }}>
            Multi-Step Abandoned-Cart Sequences. Researchers Are Sticky-Assigned A Variant. Cron Runs Every 6 Hours.
          </p>
        </div>
        <button type="button" onClick={() => setCreating((v) => !v)} className="btn-primary">
          {creating ? 'Cancel' : 'New Variant'}
        </button>
      </div>

      {creating && (
        <div className="glass-panel" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="" style={{ padding: 'var(--space-5)' }}>
            <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: 'var(--space-3)' }}>Create Variant</h3>
            <form onSubmit={createVariant} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Variant Name (e.g. discount_10pct)" required
                className="form-input"
                style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--surface-1)', border: '1px solid var(--surface-3)', color: 'var(--white)', fontSize: '0.88rem', outline: 'none' }} />
              <textarea value={newSteps} onChange={(e) => setNewSteps(e.target.value)} rows={8}
                style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--surface-1)', border: '1px solid var(--surface-3)', color: 'var(--white)', fontSize: '0.82rem', outline: 'none', resize: 'vertical', fontFamily: 'monospace' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && <div style={{ color: 'var(--grey-400)', padding: 16 }}>Loading...</div>}
      {err && <div style={{ background: 'rgba(229,62,62,0.12)', border: '1px solid rgba(229,62,62,0.4)', color: '#FFFFFF', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>{err}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {variants.map((v) => (
          <div key={v.id} className="glass-panel">
            <div className="" style={{ padding: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--white)' }}>{v.name}</h3>
                <span style={{ fontSize: '0.7rem', padding: '2px 10px', borderRadius: 999, background: v.enabled ? 'rgba(0,196,188,0.15)' : 'rgba(168,180,192,0.18)', color: v.enabled ? 'var(--teal)' : 'var(--grey-300)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {v.enabled ? 'Enabled' : 'Disabled'}
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--silver)' }}>
                    Sent <strong style={{ color: 'var(--white)' }}>{v.sent}</strong>
                  </span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--silver)' }}>
                    Recovered <strong style={{ color: 'var(--teal)' }}>{v.recovered}</strong>
                  </span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--silver)' }}>
                    Win Rate <strong style={{ color: v.winRate >= 5 ? 'var(--teal)' : 'var(--silver)' }}>{v.winRate.toFixed(1)}%</strong>
                  </span>
                  <button type="button" onClick={() => toggleEnabled(v)} className="btn-silver" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                    {v.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button type="button" onClick={() => removeVariant(v)} style={{ background: 'transparent', border: 0, color: 'var(--red)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                    Delete
                  </button>
                </div>
              </div>
              <textarea
                value={editing[v.id] !== undefined ? editing[v.id] : JSON.stringify(v.steps, null, 2)}
                onChange={(e) => setEditing((m) => ({ ...m, [v.id]: e.target.value }))}
                rows={Math.min(12, Math.max(6, JSON.stringify(v.steps, null, 2).split('\n').length))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: 'var(--surface-1)', border: '1px solid var(--surface-3)', color: 'var(--white)', fontSize: '0.82rem', outline: 'none', resize: 'vertical', fontFamily: 'monospace' }}
              />
              {editing[v.id] !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <button type="button" className="btn-silver" onClick={() => { const next = { ...editing }; delete next[v.id]; setEditing(next); }}>Cancel</button>
                  <button type="button" className="btn-primary" onClick={() => saveSteps(v)}>Save Steps</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
