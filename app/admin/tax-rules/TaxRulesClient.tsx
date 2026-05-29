'use client';

import { useState } from 'react';
import { toast } from 'sonner';

interface Rule {
  id: string;
  jurisdiction: string;
  state_code: string;
  base_rate: number | string;
  applies_to: 'subtotal' | 'subtotal_plus_shipping' | 'shipping_only';
  shipping_taxable: boolean;
  is_active: boolean;
  notes: string | null;
  updated_at: string | null;
}

interface Props {
  initialRules: Rule[];
}

export default function TaxRulesClient({ initialRules }: Props) {
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Rule>>({});
  const [saving, setSaving] = useState(false);

  function openEdit(rule: Rule) {
    setEditingId(rule.id);
    setDraft({
      state_code: rule.state_code,
      base_rate: Number(rule.base_rate),
      applies_to: rule.applies_to,
      shipping_taxable: rule.shipping_taxable,
      is_active: rule.is_active,
      notes: rule.notes,
    });
  }

  async function save() {
    if (!editingId || !draft.state_code) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/tax-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state_code: draft.state_code,
          base_rate: typeof draft.base_rate === 'string' ? Number(draft.base_rate) : draft.base_rate,
          applies_to: draft.applies_to,
          shipping_taxable: draft.shipping_taxable,
          is_active: draft.is_active,
          notes: draft.notes ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Update Failed');
      setRules(prev => prev.map(r => r.id === editingId ? { ...r, ...draft, base_rate: Number(draft.base_rate ?? r.base_rate) } as Rule : r));
      toast.success(`Updated Tax Rule For ${draft.state_code}`);
      setEditingId(null);
      setDraft({});
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed To Save';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const editing = rules.find(r => r.id === editingId) || null;

  return (
    <div className="card-metal" style={{ padding: 'var(--space-5)' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th style={{ textAlign: 'left', padding: 'var(--space-3)', color: 'var(--silver)' }}>State</th>
              <th style={{ textAlign: 'left', padding: 'var(--space-3)', color: 'var(--silver)' }}>Jurisdiction</th>
              <th style={{ textAlign: 'right', padding: 'var(--space-3)', color: 'var(--silver)' }}>Base Rate</th>
              <th style={{ textAlign: 'left', padding: 'var(--space-3)', color: 'var(--silver)' }}>Applies To</th>
              <th style={{ textAlign: 'center', padding: 'var(--space-3)', color: 'var(--silver)' }}>Ship Taxable</th>
              <th style={{ textAlign: 'center', padding: 'var(--space-3)', color: 'var(--silver)' }}>Active</th>
              <th style={{ textAlign: 'right', padding: 'var(--space-3)', color: 'var(--silver)' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: 'var(--space-3)', color: 'var(--white)', fontWeight: 600 }}>{r.state_code}</td>
                <td style={{ padding: 'var(--space-3)', color: 'var(--silver)' }}>{r.jurisdiction}</td>
                <td style={{ padding: 'var(--space-3)', textAlign: 'right', color: 'var(--teal)', fontFamily: 'var(--font-brand)' }}>
                  {(Number(r.base_rate) * 100).toFixed(3)}%
                </td>
                <td style={{ padding: 'var(--space-3)', color: 'var(--silver)' }}>{r.applies_to}</td>
                <td style={{ padding: 'var(--space-3)', textAlign: 'center', color: r.shipping_taxable ? 'var(--teal)' : 'var(--grey-400)' }}>
                  {r.shipping_taxable ? 'Yes' : 'No'}
                </td>
                <td style={{ padding: 'var(--space-3)', textAlign: 'center', color: r.is_active ? 'var(--teal)' : 'var(--red)' }}>
                  {r.is_active ? 'Active' : 'Disabled'}
                </td>
                <td style={{ padding: 'var(--space-3)', textAlign: 'right' }}>
                  <button type="button" className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 12px' }} onClick={() => openEdit(r)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div role="dialog" aria-modal="true" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)'
        }} onClick={() => setEditingId(null)}>
          <div className="card-metal" onClick={(e) => e.stopPropagation()} style={{
            width: '100%', maxWidth: 480, padding: 'var(--space-6)', border: '1px solid var(--teal)'
          }}>
            <h2 style={{ color: 'var(--white)', fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>
              Edit Tax Rule {editing.state_code}
            </h2>
            <p style={{ color: 'var(--silver)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
              Jurisdiction: {editing.jurisdiction}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Base Rate (Decimal)</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  max="0.5"
                  className="form-input"
                  value={String(draft.base_rate ?? '')}
                  onChange={(e) => setDraft(d => ({ ...d, base_rate: e.target.value === '' ? 0 : Number(e.target.value) }))}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', marginTop: 4 }}>
                  Example: 0.0725 For 7.25 Percent. Max 0.5 (50 Percent).
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Applies To</label>
                <select
                  className="form-input"
                  value={draft.applies_to ?? 'subtotal'}
                  onChange={(e) => setDraft(d => ({ ...d, applies_to: e.target.value as Rule['applies_to'] }))}
                >
                  <option value="subtotal">Subtotal Only</option>
                  <option value="subtotal_plus_shipping">Subtotal Plus Shipping</option>
                  <option value="shipping_only">Shipping Only</option>
                </select>
              </div>

              <label className="form-checkbox" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <input
                  type="checkbox"
                  checked={Boolean(draft.shipping_taxable)}
                  onChange={(e) => setDraft(d => ({ ...d, shipping_taxable: e.target.checked }))}
                />
                <span style={{ fontSize: '0.85rem', color: 'var(--silver-light)' }}>Shipping Is Taxable</span>
              </label>

              <label className="form-checkbox" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <input
                  type="checkbox"
                  checked={Boolean(draft.is_active)}
                  onChange={(e) => setDraft(d => ({ ...d, is_active: e.target.checked }))}
                />
                <span style={{ fontSize: '0.85rem', color: 'var(--silver-light)' }}>Rule Is Active</span>
              </label>

              <div className="form-group">
                <label className="form-label">Internal Notes</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={draft.notes ?? ''}
                  onChange={(e) => setDraft(d => ({ ...d, notes: e.target.value }))}
                  placeholder="Optional Internal Note (Not Shown To Buyers)"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditingId(null)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
