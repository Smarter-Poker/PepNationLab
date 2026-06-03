'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function CustomDomainsManager() {
  const [domains, setDomains] = useState<any[]>([]);
  const [newHost, setNewHost] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const r = await fetch('/api/agent/storefront/domains', { cache: 'no-store' });
    if (r.ok) setDomains((await r.json()).domains ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch('/api/agent/storefront/domains', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname: newHost }),
      });
      if (!r.ok) { const j = await r.json(); throw new Error(j.error || 'failed'); }
      setNewHost('');
      toast.success('Domain Added — Pending Verification');
      load();
    } catch (e: any) { toast.error('Failed: ' + (e.message || 'Unknown')); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm('Remove this domain?')) return;
    const r = await fetch(`/api/agent/storefront/domains/${id}`, { method: 'DELETE' });
    if (r.ok) { toast.success('Removed'); load(); } else toast.error('Failed');
  }

  return (
    <section className="glass-panel" style={{ padding: 16, borderRadius: 12 }}>
      <h3 style={{ color: 'var(--white)', marginTop: 0 }}>Custom Domains</h3>
      <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem' }}>
        Point Your Domain CNAME To pepnationlab.com — Approval Required.
      </p>
      <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input type="text" value={newHost} onChange={e => setNewHost(e.target.value)} required
          placeholder="store.example.com" pattern="[a-z0-9.\-]+\.[a-z]{2,}"
          style={{ flex: 1, padding: 12, fontSize: '16px', borderRadius: 8, minHeight: 44,
            background: 'rgba(255,255,255,0.04)', color: 'var(--white)',
            border: '1px solid rgba(255,255,255,0.1)' }} />
        <button disabled={saving} style={{
          padding: '12px 18px', minHeight: 44, borderRadius: 8,
          background: 'var(--teal)', color: 'var(--black)', border: 'none', fontWeight: 800, cursor: 'pointer',
        }}>{saving ? '...' : 'Add'}</button>
      </form>
      {domains.length === 0 ? (
        <p style={{ color: 'var(--grey-500)', fontSize: '0.85rem' }}>No Custom Domains.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {domains.map(d => (
            <li key={d.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8,
            }}>
              <div>
                <div style={{ color: 'var(--white)', fontWeight: 700 }}>{d.hostname}</div>
                <div style={{ color: 'var(--grey-500)', fontSize: '0.78rem' }}>
                  Status: <span style={{ color: d.status === 'verified' ? '#2ed573' : '#ffb800' }}>{d.status}</span>
                </div>
              </div>
              <button onClick={() => remove(d.id)} aria-label="Remove" style={{
                background: 'rgba(255,71,87,0.1)', color: '#ff4757', border: '1px solid rgba(255,71,87,0.3)',
                padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 700, minHeight: 44, fontSize: '0.82rem',
              }}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
