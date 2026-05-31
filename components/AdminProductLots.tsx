'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Plus, Upload, Trash2, Edit3, Power, Download } from 'lucide-react';
import { toast } from 'sonner';

interface Lot {
  id: string;
  product_id: string;
  lot_number: string;
  supplier: string | null;
  manufactured_at: string | null;
  expires_at: string | null;
  received_at: string;
  coa_storage_key: string | null;
  coa_mime_type: string | null;
  coa_file_size: number | null;
  coa_uploaded_at: string | null;
  coa_public_url: string | null;
  is_active: boolean;
  notes: string | null;
}

interface Props {
  productId: string;
}

const EMPTY_FORM = {
  lot_number: '',
  supplier: '',
  manufactured_at: '',
  expires_at: '',
  received_at: '',
  notes: '',
};

type FormState = typeof EMPTY_FORM;

function expiryClass(expiresAt: string | null): 'expired' | 'soon' | 'ok' {
  if (!expiresAt) return 'ok';
  const exp = new Date(expiresAt + 'T00:00:00Z').getTime();
  const now = Date.now();
  if (exp < now) return 'expired';
  const ninety = 1000 * 60 * 60 * 24 * 90;
  if (exp < now + ninety) return 'soon';
  return 'ok';
}

export default function AdminProductLots({ productId }: Props) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLot, setEditingLot] = useState<Lot | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetLotId, setUploadTargetLotId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function loadLots() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/products/${productId}/lots`, {
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? 'Failed To Load Lots.');
        setLots([]);
      } else {
        const data = await res.json();
        setLots(data.lots ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (productId) loadLots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  function openAddForm() {
    setEditingLot(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(lot: Lot) {
    setEditingLot(lot);
    setForm({
      lot_number: lot.lot_number ?? '',
      supplier: lot.supplier ?? '',
      manufactured_at: lot.manufactured_at ?? '',
      expires_at: lot.expires_at ?? '',
      received_at: lot.received_at ?? '',
      notes: lot.notes ?? '',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingLot(null);
    setForm(EMPTY_FORM);
  }

  async function saveLot(e: React.FormEvent) {
    e.preventDefault();
    if (!form.lot_number.trim()) {
      toast.error('Lot Number Is Required.');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string | null> = {
        lot_number: form.lot_number.trim(),
        supplier: form.supplier.trim() || null,
        manufactured_at: form.manufactured_at || null,
        expires_at: form.expires_at || null,
        notes: form.notes.trim() || null,
      };
      if (form.received_at) body.received_at = form.received_at;

      const url = editingLot
        ? `/api/admin/products/${productId}/lots/${editingLot.id}`
        : `/api/admin/products/${productId}/lots`;
      const method = editingLot ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? 'Save Failed.');
        return;
      }
      toast.success(editingLot ? 'Lot Updated.' : 'Lot Created.');
      closeForm();
      await loadLots();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(lot: Lot) {
    const res = await fetch(`/api/admin/products/${productId}/lots/${lot.id}`, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !lot.is_active }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data?.error ?? 'Update Failed.');
      return;
    }
    toast.success(lot.is_active ? 'Lot Deactivated.' : 'Lot Reactivated.');
    await loadLots();
  }

  async function deleteLot(lot: Lot) {
    if (!confirm(`Delete Lot "${lot.lot_number}"? This Cannot Be Undone.`)) return;
    const res = await fetch(`/api/admin/products/${productId}/lots/${lot.id}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data?.error ?? 'Delete Failed.');
      return;
    }
    toast.success('Lot Deleted.');
    await loadLots();
  }

  async function deleteCoa(lot: Lot) {
    if (!confirm(`Remove The COA For Lot "${lot.lot_number}"?`)) return;
    const res = await fetch(`/api/admin/products/${productId}/lots/${lot.id}/coa`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data?.error ?? 'Failed To Remove COA.');
      return;
    }
    toast.success('COA Removed.');
    await loadLots();
  }

  function triggerUpload(lotId: string) {
    setUploadTargetLotId(lotId);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetLotId) {
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(
        `/api/admin/products/${productId}/lots/${uploadTargetLotId}/coa`,
        { method: 'POST', credentials: 'same-origin', body: fd }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? 'Upload Failed.');
        return;
      }
      toast.success('COA Uploaded.');
      await loadLots();
    } finally {
      setUploading(false);
      setUploadTargetLotId(null);
      if (e.target) e.target.value = '';
    }
  }

  return (
    <div className="metal-frame">
      <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <div>
          <h3 style={{ fontSize: '0.95rem', color: 'var(--silver)', marginBottom: 4 }}>
            Lot Tracking And COA Documents
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)' }}>
            Each Batch Tracks Supplier, Expiry, And Its Own Certificate Of Analysis.
          </p>
        </div>
        <button
          type="button"
          className="btn-neon-cyan"
          onClick={openAddForm}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', padding: '6px 12px' }}
        >
          <Plus size={14} aria-hidden="true" /> Add Lot
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem' }}>Loading Lots...</p>
      ) : lots.length === 0 ? (
        <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem' }}>
          No Lots Recorded Yet. Use Add Lot To Register The First Batch.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {lots.map(lot => {
            const xClass = expiryClass(lot.expires_at);
            const rowBg =
              xClass === 'expired'
                ? 'rgba(229,62,62,0.08)'
                : xClass === 'soon'
                  ? 'rgba(246,173,85,0.08)'
                  : 'rgba(0,0,0,0.2)';
            const rowColor =
              xClass === 'expired'
                ? '#FCA5A5'
                : xClass === 'soon'
                  ? '#FBBF77'
                  : 'var(--silver)';
            return (
              <div
                key={lot.id}
                style={{
                  background: rowBg,
                  borderTop: '1px solid rgba(0,0,0,0.5)',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  borderLeft: '1px solid rgba(0,0,0,0.3)',
                  borderRight: '1px solid rgba(255,255,255,0.02)',
                  boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                  color: rowColor
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--grey-500)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Lot Number</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--white)' }}>{lot.lot_number}</span>
                  {lot.supplier && <span style={{ fontSize: '0.8rem', color: 'var(--silver)' }}>{lot.supplier}</span>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--grey-500)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Dates</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.8rem' }}>
                    <span>Mfg: {lot.manufactured_at ?? '—'}</span>
                    <span>Rcv: {lot.received_at}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--grey-500)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Expires</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{lot.expires_at ?? '—'}</span>
                    {xClass === 'expired' && (
                      <span className="badge" style={{ background: 'rgba(229,62,62,0.2)', color: '#FCA5A5', fontSize: '0.65rem' }}>Expired</span>
                    )}
                    {xClass === 'soon' && (
                      <span className="badge" style={{ background: 'rgba(246,173,85,0.2)', color: '#FBBF77', fontSize: '0.65rem' }}>Expiring Soon</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--grey-500)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>COA</span>
                  {lot.coa_public_url ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 4,
                      background: 'rgba(0,196,188,0.15)', color: 'var(--teal)',
                      fontSize: '0.72rem', fontWeight: 700,
                    }}>
                      <FileText size={11} aria-hidden="true" /> Attached
                    </span>
                  ) : (
                    <span style={{ color: 'var(--grey-500)', fontSize: '0.8rem' }}>None</span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '80px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--grey-500)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Status</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700,
                    background: lot.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(168,180,192,0.15)',
                    color: lot.is_active ? '#86EFAC' : 'var(--silver)',
                    display: 'inline-block', width: 'fit-content'
                  }}>
                    {lot.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap', flex: '1 1 200px' }}>
                  {lot.coa_public_url ? (
                    <>
                      <a
                        href={lot.coa_public_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-silver"
                        style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Download size={12} aria-hidden="true" /> Download COA
                      </a>
                      <button
                        type="button"
                        className="btn-silver"
                        onClick={() => triggerUpload(lot.id)}
                        disabled={uploading}
                        style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Upload size={12} aria-hidden="true" /> Replace COA
                      </button>
                      <button
                        type="button"
                        className="btn-silver"
                        onClick={() => deleteCoa(lot)}
                        style={{ padding: '6px 10px', fontSize: '0.75rem', color: '#FCA5A5', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        Remove COA
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn-silver"
                      onClick={() => triggerUpload(lot.id)}
                      disabled={uploading}
                      style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <Upload size={12} aria-hidden="true" /> Upload COA
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-silver"
                    onClick={() => openEditForm(lot)}
                    style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <Edit3 size={12} aria-hidden="true" /> Edit
                  </button>
                  <button
                    type="button"
                    className="btn-silver"
                    onClick={() => toggleActive(lot)}
                    style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <Power size={12} aria-hidden="true" /> {lot.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    className="btn-silver"
                    onClick={() => deleteLot(lot)}
                    style={{ padding: '6px 10px', fontSize: '0.75rem', color: '#FCA5A5', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <Trash2 size={12} aria-hidden="true" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div
            className="metal-frame"
            style={{ width: '100%', maxWidth: 560, margin: 'var(--space-4)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
            <h3 className="metal-text" style={{ marginBottom: 'var(--space-4)', color: '#fff', fontSize: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {editingLot ? 'Edit Lot' : 'Add Lot'}
            </h3>
            <form onSubmit={saveLot} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="lot_number">Lot Number</label>
                <input
                  id="lot_number"
                  className="form-input"
                  value={form.lot_number}
                  onChange={e => setForm(f => ({ ...f, lot_number: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="supplier">Supplier</label>
                <input
                  id="supplier"
                  className="form-input"
                  value={form.supplier}
                  onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                />
              </div>
              <div className="grid-2" style={{ gap: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="manufactured_at">Manufactured</label>
                  <input
                    id="manufactured_at"
                    type="date"
                    className="form-input"
                    value={form.manufactured_at}
                    onChange={e => setForm(f => ({ ...f, manufactured_at: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="received_at">Received</label>
                  <input
                    id="received_at"
                    type="date"
                    className="form-input"
                    value={form.received_at}
                    onChange={e => setForm(f => ({ ...f, received_at: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="expires_at">Expires</label>
                <input
                  id="expires_at"
                  type="date"
                  className="form-input"
                  value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  className="form-input"
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
                <button type="button" className="btn-silver" onClick={closeForm} disabled={saving} style={{ padding: '8px 16px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-neon-cyan" disabled={saving} style={{ padding: '8px 16px' }}>
                  {saving ? 'Saving...' : editingLot ? 'Save Changes' : 'Create Lot'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
