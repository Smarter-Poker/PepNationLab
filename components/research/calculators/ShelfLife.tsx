'use client';

import { useState, useMemo, useEffect } from 'react';
import { shelfLife } from '@/lib/compounds';
import Link from 'next/link';
import { toast } from 'sonner';
import { Plus, Trash2, Clock, RotateCw } from 'lucide-react';
import {
  CalculatorHeader,
  chromeOuterStyle,
  chromeInnerStyle,
  labelStyle,
  selectStyleBase,
  noteStyle,
  RESEARCH_NOTE,
} from './_shared';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

interface SLCompound {
  slug: string;
  display_name: string;
  reconstitution_shelf_days: number | null;
}

interface SLLog {
  id: string;
  compound_slug: string;
  label: string | null;
  reconstituted_on: string;
  shelf_days: number;
}

const SL_DEFAULT_DAYS = 28;

function todaySL(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShelfLifeSection() {
  const [slCompounds, setSlCompounds] = useState<SLCompound[]>([]);
  const [logs, setLogs] = useState<SLLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState('');
  const [slDays, setSlDays] = useState<number>(SL_DEFAULT_DAYS);
  const [slDate, setSlDate] = useState<string>(todaySL());
  const [slLabel, setSlLabel] = useState('');

  const bySlug = useMemo(() => new Map(slCompounds.map((c) => [c.slug, c])), [slCompounds]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cRes, lRes] = await Promise.all([
        fetch('/api/research/compounds-list'),
        fetch('/api/research/shelf-life'),
      ]);
      const cData = cRes.ok ? await cRes.json() : {};
      const lData = lRes.ok ? await lRes.json() : {};
      setSlCompounds((cData.compounds ?? []).map((c: Record<string, unknown>) => ({
        slug: c.slug as string,
        display_name: c.display_name as string,
        reconstitution_shelf_days: typeof c.reconstitution_shelf_days === 'number' ? c.reconstitution_shelf_days : null,
      })));
      setLogs(lData.logs ?? []);
    } catch {
      /* network error — leave empty */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  function onPickCompound(value: string) {
    setSlug(value);
    const c = bySlug.get(value);
    setSlDays(c?.reconstitution_shelf_days ?? SL_DEFAULT_DAYS);
  }

  async function addLog() {
    if (!slug) { toast.error('Select A Compound First'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/research/shelf-life', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compound_slug: slug, label: slLabel.trim() || undefined, reconstituted_on: slDate, shelf_days: slDays }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? 'Failed To Save');
        return;
      }
      toast.success('Reconstitution Logged');
      setSlLabel('');
      await loadData();
    } catch { toast.error('Failed To Save'); } finally { setSaving(false); }
  }

  async function deleteLog(id: string) {
    try {
      const res = await fetch(`/api/research/shelf-life?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed To Delete'); return; }
      setLogs((prev) => prev.filter((l) => l.id !== id));
      toast.success('Log Removed');
    } catch { toast.error('Failed To Delete'); }
  }

  const slInput: React.CSSProperties = {
    width: '100%', height: '46px', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.08)', color: '#F3F4F6',
    padding: '0 16px', borderRadius: 8, fontSize: 15, outline: 'none',
  };

  return (
    <section id="shelf-life" style={{ ...chromeOuterStyle }}>
      <div style={chromeInnerStyle}>
        <CalculatorHeader
          title="Reconstitution Shelf Life Tracker"
          why="Track When Each Vial Was Reconstituted And See Exactly How Many Days Of Usable Shelf Life Remain. Logs Are Saved To Your Account."
        />
        <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 24, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {RESEARCH_NOTE}
        </p>

        {/* Add Form */}
        <div style={{ display: 'grid', gap: 16, padding: 20, borderRadius: 16, background: 'rgba(0,196,188,0.04)', border: '1px solid rgba(0,196,188,0.12)', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Plus size={18} color="#00C4BC" />
            <span style={{ color: '#fff', fontWeight: 700 }}>Add Reconstitution</span>
          </div>
          <div>
            <label style={{ ...labelStyle }}>Compound</label>
            <select value={slug} onChange={e => onPickCompound(e.target.value)} style={selectStyleBase}>
              <option value="">Select A Compound</option>
              {slCompounds.map(c => <option key={c.slug} value={c.slug}>{c.display_name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 160px' }}>
              <label style={{ ...labelStyle }}>Reconstitution Date</label>
              <input type="date" value={slDate} onChange={e => setSlDate(e.target.value)} style={slInput} />
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <label style={{ ...labelStyle }}>Shelf Days</label>
              <input type="number" min={1} max={365} value={slDays} onChange={e => setSlDays(Number(e.target.value) || SL_DEFAULT_DAYS)} style={slInput} placeholder="E.g. 28" />
            </div>
          </div>
          <div>
            <label style={{ ...labelStyle }}>Label (Optional)</label>
            <input type="text" value={slLabel} onChange={e => setSlLabel(e.target.value)} placeholder="E.g. Vial A, Shelf 2" style={slInput} />
          </div>
          <button
            type="button"
            onClick={addLog}
            disabled={saving || !slug}
            style={{ alignSelf: 'flex-start', padding: '10px 24px', borderRadius: 10, background: slug ? 'linear-gradient(135deg,#00C4BC,#00a8a0)' : 'rgba(255,255,255,0.06)', color: slug ? '#000' : '#6B7280', fontWeight: 700, fontSize: 14, border: 'none', cursor: slug ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
          >
            {saving ? 'Saving...' : 'Add Reconstitution'}
          </button>
        </div>

        {/* Log list */}
        <div style={{ display: 'grid', gap: 12 }} aria-live="polite">
          <h3 style={{ margin: 0, color: '#fff', fontWeight: 700, fontSize: '1rem' }}>Your Reconstituted Vials</h3>
          {loading ? (
            <p style={{ color: '#6B7280', margin: 0 }}>Loading Logs...</p>
          ) : logs.length === 0 ? (
            <p style={{ color: '#6B7280', margin: 0 }}>No Reconstitutions Logged Yet.</p>
          ) : logs.map(log => {
            const comp = bySlug.get(log.compound_slug);
            const name = comp?.display_name ?? log.compound_slug;
            const life = shelfLife(log.reconstituted_on, log.shelf_days);
            const remaining = life?.remainingDays ?? 0;
            const expired = life?.expired ?? false;
            const pct = life ? Math.round(life.pct * 100) : 0;
            const lowStock = !expired && remaining <= 5;
            const barColor = expired ? '#FF6B6B' : lowStock ? '#F6AD55' : '#00C4BC';
            return (
              <div key={log.id} style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <Link href={`/research/${log.compound_slug}`} style={{ color: '#00C4BC', fontWeight: 700, fontSize: '1rem', textDecoration: 'none' }}>
                      {name}
                    </Link>
                    {log.label && <span style={{ color: '#6B7280', fontSize: '0.82rem', marginLeft: 8 }}>{log.label}</span>}
                    <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.78rem' }}>Reconstituted {log.reconstituted_on} &middot; {log.shelf_days} Day Shelf Life</p>
                  </div>
                  <button type="button" onClick={() => deleteLog(log.id)} title="Delete" style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: barColor, transition: 'width 0.3s ease' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: expired ? '#FF6B6B' : '#D0DAE4', fontSize: '0.9rem', fontWeight: 700 }}>
                  <Clock size={14} />
                  {expired ? 'Expired' : `${remaining} ${remaining === 1 ? 'Day' : 'Days'} Remaining`}
                </div>
                {lowStock && (
                  <Link href={`/research/${log.compound_slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#F6AD55', fontWeight: 700, textDecoration: 'none', fontSize: '0.88rem' }}>
                    <RotateCw size={14} /> Time To Re-Order
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        <p style={noteStyle}>{RESEARCH_NOTE}</p>
      </div>
    </section>
  );
}
