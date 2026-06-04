'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Plus, Trash2, Clock, RotateCw } from 'lucide-react';
import { shelfLife } from '@/lib/compounds';

interface PickerCompound {
  slug: string;
  display_name: string;
  reconstitution_shelf_days: number | null;
}

interface ReconstitutionLog {
  id: string;
  compound_slug: string;
  label: string | null;
  reconstituted_on: string;
  shelf_days: number;
}

interface ShelfLifeTrackerProps {
  compounds: PickerCompound[];
}

const DEFAULT_SHELF_DAYS = 28;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ShelfLifeTracker({ compounds }: ShelfLifeTrackerProps) {
  const [logs, setLogs] = useState<ReconstitutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [slug, setSlug] = useState('');
  const [shelfDays, setShelfDays] = useState<number>(DEFAULT_SHELF_DAYS);
  const [date, setDate] = useState<string>(todayISO());
  const [label, setLabel] = useState('');

  const bySlug = useMemo(() => new Map(compounds.map((c) => [c.slug, c])), [compounds]);

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await fetch('/api/research/shelf-life');
      const data = (await res.json()) as { logs?: ReconstitutionLog[] };
      setLogs(data.logs ?? []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLogs();
  }, []);

  function onPickCompound(value: string) {
    setSlug(value);
    const c = bySlug.get(value);
    setShelfDays(c?.reconstitution_shelf_days ?? DEFAULT_SHELF_DAYS);
  }

  async function addLog() {
    if (!slug) {
      toast.error('Select A Compound First');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/research/shelf-life', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compound_slug: slug,
          label: label.trim() || undefined,
          reconstituted_on: date,
          shelf_days: shelfDays,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? 'Failed To Save');
        return;
      }
      toast.success('Reconstitution Logged');
      setLabel('');
      await loadLogs();
    } catch {
      toast.error('Failed To Save');
    } finally {
      setSaving(false);
    }
  }

  async function deleteLog(id: string) {
    try {
      const res = await fetch(`/api/research/shelf-life?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        toast.error('Failed To Delete');
        return;
      }
      setLogs((prev) => prev.filter((l) => l.id !== id));
      toast.success('Log Removed');
    } catch {
      toast.error('Failed To Delete');
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '0.6rem 0.8rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #1D2D3E',
    background: '#0F1923',
    color: '#FFFFFF',
    fontSize: '0.95rem',
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
      <div className="glass-panel" style={{ padding: 0 }}>
        <div className="glass-panel">
          <div className="" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <Plus size={20} color="#00C4BC" aria-hidden="true" />
              <h2 style={{ margin: 0, color: '#FFFFFF', fontSize: '1.2rem', fontWeight: 700 }}>Add Reconstitution</h2>
            </div>

            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gap: '0.4rem' }}>
                <label htmlFor="sl-compound" style={{ color: '#A8B4C0', fontSize: '0.85rem', fontWeight: 700 }}>
                  Compound
                </label>
                <select
                  id="sl-compound"
                  value={slug}
                  onChange={(e) => onPickCompound(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select A Compound</option>
                  {compounds.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div style={{ display: 'grid', gap: '0.4rem', flex: '1 1 160px' }}>
                  <label htmlFor="sl-date" style={{ color: '#A8B4C0', fontSize: '0.85rem', fontWeight: 700 }}>
                    Reconstitution Date
                  </label>
                  <input
                    id="sl-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'grid', gap: '0.4rem', flex: '1 1 120px' }}>
                  <label htmlFor="sl-days" style={{ color: '#A8B4C0', fontSize: '0.85rem', fontWeight: 700 }}>
                    Shelf Days
                  </label>
                  <input
                    id="sl-days"
                    type="number"
                    min={1}
                    value={shelfDays}
                    onChange={(e) => setShelfDays(Number(e.target.value) || DEFAULT_SHELF_DAYS)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gap: '0.4rem' }}>
                <label htmlFor="sl-label" style={{ color: '#A8B4C0', fontSize: '0.85rem', fontWeight: 700 }}>
                  Label (Optional)
                </label>
                <input
                  id="sl-label"
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="E.g. Vial A, Shelf 2"
                  style={inputStyle}
                />
              </div>

              <div>
                <button type="button" className="btn-primary" onClick={addLog} disabled={saving || !slug}>
                  {saving ? 'Saving' : 'Add Reconstitution'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <h2 style={{ margin: 0, color: '#FFFFFF', fontSize: '1.2rem', fontWeight: 700 }}>Your Reconstituted Vials</h2>

        {loading ? (
          <p style={{ color: '#A8B4C0', margin: 0 }}>Loading Your Logs</p>
        ) : logs.length === 0 ? (
          <p style={{ color: '#A8B4C0', margin: 0 }}>No Reconstitutions Logged Yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {logs.map((log) => {
              const comp = bySlug.get(log.compound_slug);
              const name = comp?.display_name ?? log.compound_slug;
              const life = shelfLife(log.reconstituted_on, log.shelf_days);
              const remaining = life?.remainingDays ?? 0;
              const expired = life?.expired ?? false;
              const pct = life ? Math.round(life.pct * 100) : 0;
              const lowStock = !expired && remaining <= 5;

              const barColor = expired ? '#FF6B6B' : lowStock ? '#F6AD55' : '#00C4BC';

              return (
                <div
                  key={log.id}
                  className="card"
                  style={{ padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                    <div>
                      <Link
                        href={`/research/${log.compound_slug}`}
                        style={{ color: '#00C4BC', fontWeight: 700, fontSize: '1.05rem', textDecoration: 'none' }}
                      >
                        {name}
                      </Link>
                      {log.label && (
                        <span style={{ color: '#A8B4C0', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                          {log.label}
                        </span>
                      )}
                      <p style={{ margin: '0.25rem 0 0', color: '#A8B4C0', fontSize: '0.8rem' }}>
                        Reconstituted {log.reconstituted_on} For {log.shelf_days} Days
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => deleteLog(log.id)}
                      aria-label="Delete Log"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      Delete
                    </button>
                  </div>

                  <div
                    style={{
                      height: 8,
                      borderRadius: 999,
                      background: '#162230',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: barColor,
                        transition: 'width 0.2s ease',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: expired ? '#FF6B6B' : '#D0DAE4' }}>
                    <Clock size={15} aria-hidden="true" />
                    <span style={{ fontWeight: 700 }}>
                      {expired ? 'Expired' : `${remaining} ${remaining === 1 ? 'Day' : 'Days'} Remaining`}
                    </span>
                  </div>

                  {lowStock && (
                    <Link
                      href={`/research/${log.compound_slug}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        color: '#F6AD55',
                        fontWeight: 700,
                        textDecoration: 'none',
                        fontSize: '0.9rem',
                      }}
                    >
                      <RotateCw size={15} aria-hidden="true" />
                      Time To Re-Order
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
