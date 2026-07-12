'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface CatalogItem {
  key: string;
  label: string;
  description: string | null;
  grant_kind: string;
  default_value: number;
  coupon_discount_type: string | null;
}
interface Promo {
  id: string;
  code: string;
  name: string;
  reward_key: string;
  reward_value: number;
  is_active: boolean;
  max_uses: number | null;
  uses_count: number;
  ends_at: string | null;
  live?: boolean;
}

export default function SignupPromoManager({ endpoint, heading }: { endpoint: string; heading: string }) {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [rewardKey, setRewardKey] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(endpoint, { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Could Not Load Promos');
      setPromos(j.promos ?? []);
      setCatalog(j.catalog ?? []);
      if (!rewardKey && (j.catalog ?? []).length) setRewardKey(j.catalog[0].key);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could Not Load Promos');
    } finally {
      setLoading(false);
    }
  }, [endpoint, rewardKey]);

  useEffect(() => { load(); }, [load]);

  const selectedReward = catalog.find(c => c.key === rewardKey);

  async function createPromo(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) { toast.error('Enter A Promo Name'); return; }
    if (code.trim().length < 2) { toast.error('Enter A Promo Code'); return; }
    if (!rewardKey) { toast.error('Pick A Reward'); return; }
    setSaving(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim(),
          reward_key: rewardKey,
          max_uses: maxUses ? Number(maxUses) : null,
          ends_at: endsAt || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Could Not Create Promo');
      toast.success('Promo Code Created');
      setName(''); setCode(''); setMaxUses(''); setEndsAt('');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could Not Create Promo');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Promo) {
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, is_active: !p.is_active }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error || 'Failed'); }
      setPromos(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could Not Update');
    }
  }

  async function remove(p: Promo) {
    if (!confirm(`Delete promo code ${p.code}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${endpoint}?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error || 'Failed'); }
      setPromos(prev => prev.filter(x => x.id !== p.id));
      toast.success('Promo Deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could Not Delete');
    }
  }

  const labelFor = (key: string) => catalog.find(c => c.key === key)?.label ?? key;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h1 className="animated-gradient-text" style={{ color: 'var(--white)', fontSize: '1.5rem', marginBottom: 4 }}>{heading}</h1>
        <p style={{ color: 'var(--silver)', fontSize: '0.9rem' }}>
          Create a custom sign-up promo code, then pick the reward it grants new accounts on their first sign-up.
        </p>
      </div>

      {/* Create form */}
      <form onSubmit={createPromo} className="glass-panel" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          <div className="form-group" style={{ marginTop: 0 }}>
            <label className="form-label" htmlFor="promoName">Promo Name</label>
            <input id="promoName" className="form-input" placeholder="e.g. Summer Welcome" value={name} maxLength={80}
              onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginTop: 0 }}>
            <label className="form-label" htmlFor="promoCode">Promo Code</label>
            <input id="promoCode" className="form-input" placeholder="e.g. WELCOME25" value={code} maxLength={40}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
              autoCapitalize="characters" spellCheck={false} style={{ fontFamily: 'monospace', letterSpacing: '0.06em' }} />
          </div>
        </div>

        <div className="form-group" style={{ marginTop: 0 }}>
          <label className="form-label" htmlFor="reward">Reward (Choose From The List)</label>
          <select id="reward" className="form-input" value={rewardKey} onChange={e => setRewardKey(e.target.value)}>
            {catalog.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          {selectedReward?.description && (
            <p style={{ fontSize: '0.75rem', color: 'var(--grey-400)', marginTop: 4 }}>{selectedReward.description}</p>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          <div className="form-group" style={{ marginTop: 0 }}>
            <label className="form-label" htmlFor="maxUses">Max Uses (Optional)</label>
            <input id="maxUses" type="number" min={0} className="form-input" placeholder="Unlimited" value={maxUses}
              onChange={e => setMaxUses(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginTop: 0 }}>
            <label className="form-label" htmlFor="endsAt">Ends At (Optional)</label>
            <input id="endsAt" type="datetime-local" className="form-input" value={endsAt}
              onChange={e => setEndsAt(e.target.value)} />
          </div>
        </div>

        <button type="submit" className="btn btn-primary hover-lift" disabled={saving} style={{ alignSelf: 'flex-start' }}>
          {saving ? 'Creating...' : 'Create Promo Code'}
        </button>
      </form>

      {/* List */}
      <div className="glass-panel" style={{ padding: 'var(--space-5)' }}>
        <h2 style={{ color: 'var(--white)', fontSize: '1.05rem', marginBottom: 'var(--space-4)' }}>Your Promo Codes</h2>
        {loading ? (
          <p style={{ color: 'var(--grey-400)' }}>Loading...</p>
        ) : promos.length === 0 ? (
          <p style={{ color: 'var(--grey-400)' }}>No promo codes yet. Create one above.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {promos.map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)', borderRadius: 10, flexWrap: 'wrap',
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--silver-dark)',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 200 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--teal)', letterSpacing: '0.06em' }}>{p.code}</span>
                  <span style={{ color: 'var(--white)', fontSize: '0.85rem' }}>{p.name}</span>
                  <span style={{ color: 'var(--silver)', fontSize: '0.78rem' }}>Reward: {labelFor(p.reward_key)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                  <span style={{ color: 'var(--grey-400)', fontSize: '0.78rem' }}>
                    {p.uses_count}{p.max_uses != null ? ` / ${p.max_uses}` : ''} used
                  </span>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                    color: p.live ? '#04231F' : '#CBD5E1',
                    background: p.live ? 'linear-gradient(180deg,#2fe0c9,#12b3a0)' : 'rgba(255,255,255,0.08)',
                  }}>{p.live ? 'LIVE' : (p.is_active ? 'SCHEDULED' : 'OFF')}</span>
                  <button type="button" onClick={() => toggleActive(p)} className="btn btn-secondary btn-sm">
                    {p.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button type="button" onClick={() => remove(p)} className="btn btn-sm"
                    style={{ color: 'var(--red)', border: '1px solid rgba(229,62,62,0.4)', background: 'transparent' }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
