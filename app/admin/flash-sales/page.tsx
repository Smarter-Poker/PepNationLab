'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface FlashSale {
  id: string;
  name: string;
  banner_text: string | null;
  discount_pct: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function AdminFlashSalesPage() {
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [bannerText, setBannerText] = useState('');
  const [discount, setDiscount] = useState('10');
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [endsAt, setEndsAt] = useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/flash-sales', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) setSales(json.sales ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/flash-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          banner_text: bannerText || null,
          discount_pct: Number(discount),
          starts_at: new Date(startsAt).toISOString(),
          ends_at: new Date(endsAt).toISOString(),
          is_active: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Failed To Create'); return; }
      toast.success('Flash Sale Created');
      setName(''); setBannerText(''); setDiscount('10');
      setCreating(false);
      load();
    } catch { toast.error('Network Error'); }
  };

  const toggleActive = async (s: FlashSale) => {
    try {
      const res = await fetch(`/api/admin/flash-sales/${encodeURIComponent(s.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !s.is_active }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || 'Failed To Update Sale'); return; }
      toast.success(s.is_active ? 'Sale Deactivated' : 'Sale Activated - Banner Live Globally');
      load();
    } catch { toast.error('Network Error'); }
  };

  const remove = async (s: FlashSale) => {
    if (!confirm(`Delete "${s.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/flash-sales/${encodeURIComponent(s.id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error || 'Failed To Delete Sale');
        return;
      }
      toast.success('Flash Sale Deleted');
      load();
    } catch { toast.error('Network Error'); }
  };

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 className="animated-gradient-text" style={{ fontSize: '1.6rem', margin: 0 }}>Flash Sales</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginTop: 6, marginBottom: 0 }}>
            Platform-Wide Sale Banners. Toggle Active To Push Live On Every Storefront Instantly.
          </p>
        </div>
        <button type="button" onClick={() => setCreating((v) => !v)} className="btn-primary">
          {creating ? 'Cancel' : 'New Flash Sale'}
        </button>
      </div>

      {creating && (
        <div className="glass-panel" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="" style={{ padding: 'var(--space-5)' }}>
            <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: 'var(--space-3)' }}>Create Flash Sale</h3>
            <form onSubmit={create} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Name</span>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120}
                  style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--surface-1)', border: '1px solid var(--surface-3)', color: 'var(--white)', fontSize: '0.88rem', outline: 'none' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Discount %</span>
                <input type="number" min="0" max="90" step="1" value={discount} onChange={(e) => setDiscount(e.target.value)} required className="form-input"
                  style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--surface-1)', border: '1px solid var(--surface-3)', color: 'var(--white)', fontSize: '0.88rem', outline: 'none' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Banner Text (Optional)</span>
                <input type="text" value={bannerText} onChange={(e) => setBannerText(e.target.value)} placeholder="Flash Sale: 10% Off Site-Wide. Ends Soon."
                  style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--surface-1)', border: '1px solid var(--surface-3)', color: 'var(--white)', fontSize: '0.88rem', outline: 'none' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Starts At</span>
                <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required
                  style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--surface-1)', border: '1px solid var(--surface-3)', color: 'var(--white)', fontSize: '0.88rem', outline: 'none' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Ends At</span>
                <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required
                  style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--surface-1)', border: '1px solid var(--surface-3)', color: 'var(--white)', fontSize: '0.88rem', outline: 'none' }} />
              </label>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn-primary">Save (Inactive)</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && <div style={{ color: 'var(--grey-400)', padding: 16 }}>Loading...</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {sales.map((s) => (
          <div key={s.id} className="glass-panel">
            <div className="" style={{ padding: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <h3 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--white)' }}>{s.name}</h3>
                  <span style={{ fontSize: '0.7rem', padding: '2px 10px', borderRadius: 999, background: s.is_active ? 'var(--teal)' : 'rgba(168,180,192,0.18)', color: s.is_active ? '#000' : 'var(--grey-300)', fontWeight: 800, textTransform: 'uppercase' }}>
                    {s.is_active ? 'Live Now' : 'Inactive'}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--silver)' }}>
                  {s.discount_pct}% Off - {fmtWhen(s.starts_at)} to {fmtWhen(s.ends_at)}
                </div>
                {s.banner_text && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginTop: 4, fontStyle: 'italic' }}>
                    "{s.banner_text}"
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button type="button" onClick={() => toggleActive(s)} className={s.is_active ? 'btn-silver' : 'btn-primary'} style={{ padding: '8px 14px', fontSize: '0.82rem' }}>
                  {s.is_active ? 'Deactivate' : 'Execute Sale'}
                </button>
                <button type="button" onClick={() => remove(s)} style={{ background: 'transparent', border: 0, color: 'var(--red)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {!loading && sales.length === 0 && (
          <div className="glass-panel">
            <div className="" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--grey-400)' }}>
              No Flash Sales Configured.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
