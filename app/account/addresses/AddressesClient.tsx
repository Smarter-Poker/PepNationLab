'use client';

import { useState } from 'react';
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
  created_at: string;
  updated_at: string;
}

const EMPTY: Omit<Address, 'id' | 'created_at' | 'updated_at' | 'is_default'> = {
  label: '',
  full_name: '',
  street1: '',
  street2: '',
  city: '',
  state: '',
  zip: '',
  country: 'US',
};

export default function AddressesClient({ initialAddresses }: { initialAddresses: Address[] }) {
  const [addresses, setAddresses] = useState<Address[]>(initialAddresses);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

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
    });
  }

  async function submit() {
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

  async function makeDefault(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/account/addresses/${id}/default`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Update Failed');
      }
      setAddresses((prev) =>
        prev.map((a) => ({ ...a, is_default: a.id === id })).sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0))
      );
      toast.success('Default Address Updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
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
        <div className="card-metal" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
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
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <button className="btn btn-primary" disabled={busy} onClick={submit}>
              {busy ? 'Saving…' : 'Save Address'}
            </button>
            <button className="btn btn-secondary" disabled={busy} onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {addresses.length === 0 ? (
        <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <p style={{ color: 'var(--silver)' }}>You Have No Saved Addresses Yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {addresses.map((a) => (
            <div key={a.id} className="card-glass" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ color: 'var(--white)', fontWeight: 700 }}>{a.label || 'Saved Address'}</span>
                    {a.is_default && (
                      <span style={{ background: 'var(--teal)', color: 'var(--black)', fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>
                        Default
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
                  {!a.is_default && (
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => makeDefault(a.id)}>
                      Make Default
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
