'use client';

import { useState } from 'react';

export interface IntranasalRow {
  slug: string;
  display_name: string;
  category: string | null;
  evidence_tier: string;
  intranasal_status: 'established' | 'emerging' | 'not_suitable' | null;
  intranasal_bioavailability_pct: number | null;
  intranasal_note: string | null;
}

const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'established', label: 'Nasal: Established', color: '#68D391' },
  { value: 'emerging', label: 'Nasal: Emerging', color: '#00E5FF' },
  { value: 'not_suitable', label: 'Injection Only', color: '#A8B4C0' },
];

export default function AdminIntranasalEditor({ rows }: { rows: IntranasalRow[] }) {
  const [filter, setFilter] = useState('');
  const q = filter.trim().toLowerCase();
  const visible = q
    ? rows.filter((r) => r.display_name.toLowerCase().includes(q) || r.slug.includes(q))
    : rows;

  return (
    <div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter Compounds..."
        style={{ width: '100%', maxWidth: 360, padding: '10px 12px', marginBottom: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#FFFFFF', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map((r) => <EditorRow key={r.slug} row={r} />)}
      </div>
      {visible.length === 0 && (
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem' }}>No Compounds Match That Filter.</p>
      )}
    </div>
  );
}

function EditorRow({ row }: { row: IntranasalRow }) {
  const [status, setStatus] = useState<string>(row.intranasal_status ?? 'not_suitable');
  const [note, setNote] = useState<string>(row.intranasal_note ?? '');
  const [bio, setBio] = useState<string>(row.intranasal_bioavailability_pct != null ? String(row.intranasal_bioavailability_pct) : '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/research/intranasal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ slug: row.slug, status, note, bioavailability_pct: bio === '' ? null : bio }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setMsg({ ok: true, text: 'Saved' });
      else setMsg({ ok: false, text: data.error || 'Save Failed' });
    } catch {
      setMsg({ ok: false, text: 'Network Error' });
    } finally {
      setSaving(false);
    }
  };

  const statusColor = STATUS_OPTIONS.find((o) => o.value === status)?.color ?? '#A8B4C0';

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ flex: '1 1 180px', minWidth: 140 }}>
        <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '0.92rem' }}>{row.display_name}</div>
        <div style={{ color: '#7E8A98', fontSize: '0.72rem' }}>{row.slug}{row.category ? ` · ${row.category}` : ''}</div>
      </div>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        aria-label={`Nasal route tier for ${row.display_name}`}
        style={{ padding: '8px 10px', borderRadius: 8, background: '#0F1923', color: statusColor, border: `1px solid ${statusColor}55`, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
      >
        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value} style={{ color: '#FFFFFF' }}>{o.label}</option>)}
      </select>
      <input
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Bioavail %"
        inputMode="decimal"
        aria-label={`Nasal bioavailability percent for ${row.display_name}`}
        style={{ width: 96, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#FFFFFF', fontSize: '0.82rem', boxSizing: 'border-box' }}
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Caveat / note"
        aria-label={`Route note for ${row.display_name}`}
        style={{ flex: '2 1 240px', minWidth: 160, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#FFFFFF', fontSize: '0.82rem', boxSizing: 'border-box' }}
      />
      <button
        onClick={save}
        disabled={saving}
        style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#00C4BC', color: '#04221F', fontWeight: 800, fontSize: '0.82rem', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
      {msg && <span style={{ fontSize: '0.78rem', fontWeight: 700, color: msg.ok ? '#68D391' : '#FC8181' }}>{msg.text}</span>}
    </div>
  );
}
