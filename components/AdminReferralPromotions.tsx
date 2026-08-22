'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gift, Plus, Trash2, Power, Check } from 'lucide-react';

// Admin management for custom referral promotions. A live promotion overrides
// the base referral reward amounts. Talks to /api/admin/referral-promotions.

interface Promo {
  id: string;
  name: string;
  referrer_reward: number;
  referee_reward: number;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  priority: number;
  live?: boolean;
}

export default function AdminReferralPromotions() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [referrer, setReferrer] = useState('20');
  const [referee, setReferee] = useState('20');
  const [priority, setPriority] = useState('0');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch('/api/admin/referral-promotions', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error();
      setPromos(Array.isArray(json.data) ? json.data : []);
    } catch { setErr('Could Not Load Promotions.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setFormErr(null);
    try {
      const res = await fetch('/api/admin/referral-promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          referrer_reward: referrer,
          referee_reward: referee,
          priority,
          description: description || null,
          starts_at: startsAt || null,
          ends_at: endsAt || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setFormErr(json?.error || 'Could Not Create.'); return; }
      setName(''); setDescription(''); setStartsAt(''); setEndsAt(''); setPriority('0');
      await load();
    } catch { setFormErr('Something Went Wrong.'); }
    finally { setBusy(false); }
  };

  const toggle = async (p: Promo) => {
    await fetch('/api/admin/referral-promotions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, is_active: !p.is_active }),
    });
    await load();
  };

  const remove = async (p: Promo) => {
    if (!confirm(`Delete The Promotion "${p.name}"?`)) return;
    await fetch(`/api/admin/referral-promotions?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' });
    await load();
  };

  const input: React.CSSProperties = { width: '100%', padding: '0.6rem 0.8rem', background: '#0F1923', border: '1px solid #1D2D3E', borderRadius: '10px', color: '#FFFFFF', fontSize: '0.9rem' };
  const label: React.CSSProperties = { display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#A8B4C0', marginBottom: '0.3rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#FFFFFF', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Gift size={26} color="#00C4BC" /> Referral Promotions
        </h1>
        <p style={{ color: '#A8B4C0', marginTop: '0.4rem', fontSize: '0.95rem' }}>
          Schedule Limited-Time Reward Boosts. While A Promotion Is Live, New Referrals Use Its Reward Amounts Instead Of The Base Settings. Highest Priority Wins If Several Overlap.
        </p>
      </div>

      <form onSubmit={create} style={{ padding: '1.5rem', background: '#0F1923', border: '1px solid #1D2D3E', borderRadius: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
          <div><label style={label}>Name</label><input required value={name} onChange={e => setName(e.target.value)} placeholder="Double Rewards Week" style={input} /></div>
          <div><label style={label}>Referrer Reward ($)</label><input required type="number" min="0" step="0.01" value={referrer} onChange={e => setReferrer(e.target.value)} style={input} /></div>
          <div><label style={label}>Referee Reward ($)</label><input required type="number" min="0" step="0.01" value={referee} onChange={e => setReferee(e.target.value)} style={input} /></div>
          <div><label style={label}>Priority</label><input type="number" step="1" value={priority} onChange={e => setPriority(e.target.value)} style={input} /></div>
          <div><label style={label}>Starts (Optional)</label><input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} style={input} /></div>
          <div><label style={label}>Ends (Optional)</label><input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} style={input} /></div>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <label style={label}>Description (Optional)</label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Refer A Friend, You Both Get $30" style={input} />
        </div>
        {formErr && <p style={{ color: '#E53E3E', fontSize: '0.85rem', margin: '0.85rem 0 0' }}>{formErr}</p>}
        <div style={{ marginTop: '1.15rem' }}>
          <button type="submit" disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.3rem', background: '#00C4BC', color: '#050A0F', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.65 : 1 }}>
            <Plus size={17} /> {busy ? 'Creating...' : 'Create Promotion'}
          </button>
        </div>
      </form>

      <div>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 0.85rem' }}>All Promotions</h2>
        {loading ? <p style={{ color: '#A8B4C0' }}>Loading...</p>
          : err ? <p style={{ color: '#E53E3E' }}>{err}</p>
          : promos.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', background: '#0F1923', border: '1px dashed #1D2D3E', borderRadius: '16px', color: '#A8B4C0' }}>No Promotions Yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {promos.map(p => (
                <div key={p.id} style={{ padding: '1.1rem 1.25rem', background: '#0F1923', border: `1px solid ${p.live ? 'rgba(0,196,188,0.5)' : '#1D2D3E'}`, borderRadius: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{p.name}</span>
                        {p.live && <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '999px', background: 'rgba(0,196,188,0.14)', color: '#00C4BC', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Check size={12} /> Live</span>}
                        {!p.is_active && <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '999px', background: 'rgba(168,180,192,0.14)', color: '#A8B4C0' }}>Paused</span>}
                      </div>
                      <div style={{ color: '#A8B4C0', fontSize: '0.82rem', marginTop: '0.35rem', display: 'flex', gap: '0.9rem', flexWrap: 'wrap' }}>
                        <span>Referrer ${Number(p.referrer_reward).toFixed(2)}</span>
                        <span>Referee ${Number(p.referee_reward).toFixed(2)}</span>
                        <span>Priority {p.priority}</span>
                        <span>{new Date(p.starts_at).toLocaleDateString()}{p.ends_at ? ` - ${new Date(p.ends_at).toLocaleDateString()}` : ' - No End'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => toggle(p)} aria-label={p.is_active ? 'Pause' : 'Activate'} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#162230', border: '1px solid #1D2D3E', color: '#FFFFFF', borderRadius: '8px', padding: '0.45rem 0.7rem', cursor: 'pointer', fontSize: '0.82rem' }}><Power size={14} /> {p.is_active ? 'Pause' : 'Activate'}</button>
                      <button onClick={() => remove(p)} aria-label="Delete" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'transparent', border: '1px solid rgba(229,62,62,0.4)', color: '#E53E3E', borderRadius: '8px', padding: '0.45rem 0.7rem', cursor: 'pointer', fontSize: '0.82rem' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
