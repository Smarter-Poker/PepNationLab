'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { toast } from 'sonner';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface CrmRow {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  auto_approve_orders: boolean;
  order_count: number;
  total_spent: number;
  avg_order: number;
  last_order_at: string | null;
  last_sign_in_at?: string | null;
  first_sign_in_at?: string | null;
  note: string;
}

interface CrmTotals {
  researchers: number;
  lifetime_value: number;
  total_orders: number;
  active_buyers: number;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */
function money(n: number): string {
  return `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function daysAgo(iso: string | null): string {
  if (!iso) return 'No Orders Yet';
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d} Days Ago`;
  const m = Math.floor(d / 30);
  return m === 1 ? '1 Month Ago' : `${m} Months Ago`;
}

/* ─── KPI card ──────────────────────────────────────────────────────────── */
function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-metal" style={{ padding: 'var(--space-4)', flex: '1 1 140px', minWidth: 140 }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--white)', fontFamily: 'var(--font-brand)' }}>
        {value}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Agent Researcher CRM
   ══════════════════════════════════════════════════════════════════════════ */
export default function AgentResearcherCRM() {
  const [rows, setRows] = useState<CrmRow[]>([]);
  const [totals, setTotals] = useState<CrmTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [phoneDraft, setPhoneDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agent/researchers/crm', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed To Load CRM');
      const json = await res.json();
      setRows(json.data ?? []);
      setTotals(json.totals ?? null);
    } catch {
      toast.error('Could Not Load Researcher CRM');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNote = (row: CrmRow) => {
    if (openId === row.id) {
      setOpenId(null);
      return;
    }
    setOpenId(row.id);
    setDraft(row.note ?? '');
    setEmailDraft(row.email ?? '');
    setPhoneDraft(row.phone ?? '');
  };

  const saveNote = async (researcherId: string) => {
    setSaving(true);
    try {
      const [noteRes, contactRes] = await Promise.all([
        fetch('/api/agent/researchers/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ researcherId, note: draft }),
        }),
        fetch('/api/agent/researchers/contact', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ researcherId, email: emailDraft, phone: phoneDraft }),
        })
      ]);
      
      if (!noteRes.ok || !contactRes.ok) throw new Error('Save Failed');
      
      setRows(prev => prev.map(r => r.id === researcherId ? { ...r, note: draft, email: emailDraft, phone: phoneDraft } : r));
      setOpenId(null);
      toast.success('Changes Saved');
    } catch {
      toast.error('Could Not Save Changes');
    } finally {
      setSaving(false);
    }
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter(r =>
        (r.full_name ?? '').toLowerCase().includes(q) ||
        (r.username ?? '').toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q))
    : rows;

  return (
    <div style={{
      borderRadius: 20,
      padding: 10,
      background: 'linear-gradient(145deg, #c8c2b8 0%, #a09890 30%, #8a847c 50%, #a09890 70%, #c8c2b8 100%)',
      boxShadow: '0 8px 48px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.4)',
      marginBottom: 'var(--space-6)'
    }}>
      <div style={{
        borderRadius: 12,
        background: 'linear-gradient(180deg, #1a1f2e 0%, #141820 40%, #111520 100%)',
        padding: 'var(--space-6)',
        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--white)', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
            Researcher CRM
          </h3>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', margin: 0 }}>
            Lifetime Value, Order History, And Private Notes For Each Researcher
          </p>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          <Kpi label="Researchers" value={String(totals?.researchers ?? 0)} />
          <Kpi label="Lifetime Value" value={money(totals?.lifetime_value ?? 0)} />
          <Kpi label="Total Orders" value={String(totals?.total_orders ?? 0)} />
          <Kpi label="Active Buyers" value={String(totals?.active_buyers ?? 0)} />
        </div>

        {/* Search */}
        <input
          type="text"
          className="form-input"
          placeholder="Search By Name, Username, Or Email"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ width: '100%', marginBottom: 'var(--space-4)' }}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', color: 'var(--grey-400)', fontSize: '0.85rem' }}>
            Loading Researcher Data...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', opacity: 0.6 }}>
            <h4 style={{ color: 'var(--silver)' }}>No Researchers Found</h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', margin: 0 }}>
              Create A Researcher Account Below To Start Building Your Book Of Business.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--grey-400)' }}>
                  <th style={{ padding: 'var(--space-3) 8px var(--space-3) 0', fontWeight: 600 }}>Researcher</th>
                  <th style={{ padding: 'var(--space-3) 8px', fontWeight: 600, textAlign: 'right' }}>Lifetime Value</th>
                  <th style={{ padding: 'var(--space-3) 8px', fontWeight: 600, textAlign: 'right' }}>Orders</th>
                  <th style={{ padding: 'var(--space-3) 8px', fontWeight: 600, textAlign: 'right' }}>Avg Order</th>
                  <th style={{ padding: 'var(--space-3) 8px', fontWeight: 600 }}>Last Order</th>
                  <th style={{ padding: 'var(--space-3) 8px', fontWeight: 600 }}>Last Logged In</th>
                  <th style={{ padding: 'var(--space-3) 0 var(--space-3) 8px', fontWeight: 600, textAlign: 'right' }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <Fragment key={r.id}>
                    <tr style={{ borderBottom: openId === r.id ? 'none' : '1px solid rgba(255,255,255,0.03)', color: 'var(--silver-light)' }}>
                      <td style={{ padding: 'var(--space-3) 8px var(--space-3) 0' }}>
                        <div style={{ fontWeight: 600, color: 'var(--white)' }}>{r.full_name || 'Anonymous Researcher'}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: 'var(--teal)' }}>
                          @{r.username ?? (r.email ? r.email.split('@')[0] : 'researcher')}
                        </div>
                      </td>
                      <td style={{ padding: 'var(--space-3) 8px', textAlign: 'right', fontWeight: 700, color: 'var(--white)' }}>{money(r.total_spent)}</td>
                      <td style={{ padding: 'var(--space-3) 8px', textAlign: 'right' }}>{r.order_count}</td>
                      <td style={{ padding: 'var(--space-3) 8px', textAlign: 'right' }}>{r.order_count > 0 ? money(r.avg_order) : '—'}</td>
                      <td style={{ padding: 'var(--space-3) 8px' }}>{daysAgo(r.last_order_at)}</td>
                      <td style={{ padding: 'var(--space-3) 8px', color: r.last_sign_in_at ? 'var(--silver-light)' : 'var(--grey-500)', fontStyle: r.last_sign_in_at ? 'normal' : 'italic' }}>
                        {r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never Logged In'}
                      </td>
                      <td style={{ padding: 'var(--space-3) 0 var(--space-3) 8px', textAlign: 'right' }}>
                        <button
                          onClick={() => openNote(r)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '4px 10px', fontSize: '0.72rem', color: r.note ? 'var(--teal)' : 'var(--grey-400)' }}
                        >
                          {r.note ? 'Edit Note' : 'Add Note'}
                        </button>
                      </td>
                    </tr>
                    {openId === r.id && (
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td colSpan={7} style={{ padding: '0 0 var(--space-4)' }}>
                          <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 'var(--space-4)', border: '1px solid rgba(192,184,168,0.12)' }}>
                            
                            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                              <div style={{ flex: '1 1 200px' }}>
                                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                                  Email Address
                                </label>
                                <input
                                  type="email"
                                  value={emailDraft}
                                  onChange={e => setEmailDraft(e.target.value)}
                                  placeholder="researcher@example.com"
                                  style={{
                                    width: '100%', boxSizing: 'border-box',
                                    background: 'var(--surface-3, #1D2D3E)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 8, padding: '10px 12px',
                                    color: 'var(--white)', fontSize: '0.85rem',
                                    outline: 'none',
                                  }}
                                />
                              </div>
                              <div style={{ flex: '1 1 200px' }}>
                                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                                  Phone Number
                                </label>
                                <input
                                  type="tel"
                                  value={phoneDraft}
                                  onChange={e => setPhoneDraft(e.target.value)}
                                  placeholder="(555) 123-4567"
                                  style={{
                                    width: '100%', boxSizing: 'border-box',
                                    background: 'var(--surface-3, #1D2D3E)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 8, padding: '10px 12px',
                                    color: 'var(--white)', fontSize: '0.85rem',
                                    outline: 'none',
                                  }}
                                />
                              </div>
                            </div>

                            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                              Private Note (Only You Can See This)
                            </label>
                            <textarea
                              value={draft}
                              onChange={e => setDraft(e.target.value)}
                              rows={3}
                              maxLength={4000}
                              placeholder="E.g. Prefers Bulk Orders, Texts On Weekends, Interested In New Peptides..."
                              style={{
                                width: '100%', boxSizing: 'border-box',
                                background: 'var(--surface-3, #1D2D3E)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 8, padding: '10px 12px',
                                color: 'var(--white)', fontSize: '0.85rem', resize: 'vertical',
                                outline: 'none',
                              }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => setOpenId(null)} disabled={saving}>Cancel</button>
                              <button className="btn btn-primary btn-sm" onClick={() => saveNote(r.id)} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Changes'}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
