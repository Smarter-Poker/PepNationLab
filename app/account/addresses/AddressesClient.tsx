'use client';

/**
 * AddressesClient — Round 25
 * --------------------------------------------------------------
 * Two kinds of saved addresses on one screen:
 *   - Ship-To  : where the user receives orders
 *   - Ship-From: the return address printed on outbound labels
 *                when the user sends a package
 *
 * One address can be marked as BOTH at the same time (one click).
 * Each kind has its own default flag (is_default / is_default_from).
 *
 * Schema (saved_addresses):
 *   is_ship_to        BOOLEAN  eligible for ship-to selection
 *   is_ship_from      BOOLEAN  eligible for ship-from selection
 *   is_default        BOOLEAN  default ship-to
 *   is_default_from   BOOLEAN  default ship-from
 */

import { useMemo, useState } from 'react';
import { toast } from 'sonner';

interface Address {
  id: string;
  label: string | null;
  full_name: string;
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  is_default: boolean;
  is_default_from: boolean;
  is_ship_to: boolean;
  is_ship_from: boolean;
  created_at: string;
  updated_at: string;
}

type FormState = Omit<Address, 'id' | 'created_at' | 'updated_at' | 'is_default' | 'is_default_from'>;

const EMPTY: FormState = {
  label: '',
  full_name: '',
  street1: '',
  street2: '',
  city: '',
  state: '',
  zip: '',
  country: 'US',
  is_ship_to: true,
  is_ship_from: false,
};

export default function AddressesClient({ initialAddresses }: { initialAddresses: Address[] }) {
  const [addresses, setAddresses] = useState<Address[]>(initialAddresses);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    let to = 0;
    let from = 0;
    let both = 0;
    for (const a of addresses) {
      if (a.is_ship_to) to += 1;
      if (a.is_ship_from) from += 1;
      if (a.is_ship_to && a.is_ship_from) both += 1;
    }
    return { to, from, both };
  }, [addresses]);

  function reset() {
    setForm(EMPTY);
    setEditingId(null);
    setCreating(false);
  }

  function beginEdit(a: Address) {
    setEditingId(a.id);
    setCreating(false);
    setForm({
      label: a.label ?? '',
      full_name: a.full_name,
      street1: a.street1,
      street2: a.street2 ?? '',
      city: a.city,
      state: a.state,
      zip: a.zip,
      country: a.country,
      is_ship_to: a.is_ship_to,
      is_ship_from: a.is_ship_from,
    });
  }

  function setBoth() {
    setForm((f) => ({ ...f, is_ship_to: true, is_ship_from: true }));
  }

  async function submit() {
    // Defensive: an address must be at least one kind.
    if (!form.is_ship_to && !form.is_ship_from) {
      toast.error('Pick At Least One: Ship-To, Ship-From, Or Both.');
      return;
    }
    setBusy(true);
    try {
      const url = editingId
        ? `/api/account/addresses/${editingId}`
        : '/api/account/addresses';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Save Failed');
      if (editingId) {
        setAddresses((prev) => prev.map((a) => (a.id === editingId ? json.data : a)));
        toast.success('Address Updated');
      } else {
        setAddresses((prev) => [json.data, ...prev]);
        toast.success('Address Saved');
      }
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save Failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete This Address?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/account/addresses/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Delete Failed');
      }
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      toast.success('Address Deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete Failed');
    } finally {
      setBusy(false);
    }
  }

  async function makeDefault(id: string, kind: 'to' | 'from') {
    setBusy(true);
    try {
      const res = await fetch(`/api/account/addresses/${id}/default?kind=${kind}`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Update Failed');
      }
      setAddresses((prev) =>
        prev
          .map((a) => {
            if (kind === 'to') return { ...a, is_default: a.id === id };
            return { ...a, is_default_from: a.id === id };
          })
          .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0)),
      );
      toast.success(kind === 'to' ? 'Default Ship-To Updated' : 'Default Ship-From Updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--silver)', fontSize: '0.82rem' }}>
          {counts.to} Ship-To . {counts.from} Ship-From . {counts.both} Saved For Both
        </span>
      </div>

      {!editingId && !creating && (
        <button
          className="btn btn-primary"
          onClick={() => setCreating(true)}
          style={{ marginBottom: 'var(--space-4)' }}
        >
          Add New Address
        </button>
      )}

      {(editingId || creating) && (
        <div className="card-metal hover-lift stagger-fade-in" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-5)', animationDelay: '0.1s' }}>
          <h2 style={{ color: 'var(--white)', fontSize: '1.05rem', marginBottom: 'var(--space-3)' }}>
            {editingId ? 'Edit Address' : 'Add New Address'}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 'var(--space-3)' }}>
            <Field label="Label (Optional)" value={form.label ?? ''} onChange={(v) => setForm({ ...form, label: v })} placeholder="Home, Lab, Office" />
            <Field label="Full Name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} required />
            <Field label="Street Address" value={form.street1} onChange={(v) => setForm({ ...form, street1: v })} required />
            <Field label="Apt / Suite (Optional)" value={form.street2 ?? ''} onChange={(v) => setForm({ ...form, street2: v })} />
            <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} required />
            <Field label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} required />
            <Field label="ZIP" value={form.zip} onChange={(v) => setForm({ ...form, zip: v })} required />
            <Field label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} required />
          </div>

          <fieldset style={{ marginTop: 'var(--space-4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)' }}>
            <legend style={{ color: 'var(--silver)', fontSize: '0.78rem', padding: '0 var(--space-2)' }}>Use This Address For</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--white)' }}>
                <input
                  type="checkbox"
                  checked={form.is_ship_to}
                  onChange={(e) => setForm({ ...form, is_ship_to: e.target.checked })}
                />
                Ship-To (Receiving Orders)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--white)' }}>
                <input
                  type="checkbox"
                  checked={form.is_ship_from}
                  onChange={(e) => setForm({ ...form, is_ship_from: e.target.checked })}
                />
                Ship-From (Return Address On Outbound Labels)
              </label>
              <button
                type="button"
                onClick={setBoth}
                className="btn btn-ghost btn-sm"
                style={{ alignSelf: 'flex-start', marginTop: 'var(--space-1)' }}
              >
                Save As Both
              </button>
            </div>
          </fieldset>

          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={busy} onClick={submit}>
              {busy ? 'Saving' : 'Save Address'}
            </button>
            <button className="btn btn-secondary" disabled={busy} onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {addresses.length === 0 ? (
        <div className="card-metal hover-lift stagger-fade-in" style={{ padding: 'var(--space-6)', textAlign: 'center', animationDelay: '0.2s' }}>
          <p style={{ color: 'var(--silver)' }}>You Have No Saved Addresses Yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {addresses.map((a, index) => (
            <div key={a.id} className="card-glass hover-lift stagger-fade-in" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', animationDelay: `${0.1 + index * 0.06}s` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--white)', fontWeight: 700 }}>{a.label || 'Saved Address'}</span>
                    {a.is_ship_to && (
                      <span style={{ background: 'rgba(0,196,188,0.12)', color: 'var(--teal)', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                        Ship-To{a.is_default ? ' . Default' : ''}
                      </span>
                    )}
                    {a.is_ship_from && (
                      <span style={{ background: 'rgba(168,180,192,0.14)', color: 'var(--silver)', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                        Ship-From{a.is_default_from ? ' . Default' : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'var(--silver)', marginTop: 4, fontSize: '0.9rem' }}>
                    {a.full_name}<br />
                    {a.street1}{a.street2 ? `, ${a.street2}` : ''}<br />
                    {a.city}, {a.state} {a.zip}<br />
                    {a.country}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {a.is_ship_to && !a.is_default && (
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => makeDefault(a.id, 'to')}>
                      Default Ship-To
                    </button>
                  )}
                  {a.is_ship_from && !a.is_default_from && (
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => makeDefault(a.id, 'from')}>
                      Default Ship-From
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => beginEdit(a)}>
                    Edit
                  </button>
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => remove(a.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <span style={{ color: 'var(--silver)', fontSize: '0.78rem' }}>{label}{required ? ' *' : ''}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input"
        required={required}
        style={{
          background: 'var(--surface-2)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'var(--white)',
          padding: '0.6rem 0.75rem',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.9rem',
        }}
      />
    </label>
  );
}
