'use client';

import { useState } from 'react';

/**
 * Admin editor for real Certificate Of Analysis results.
 *
 * Writes only what the admin types, through the existing admin-gated, CSRF-checked
 * routes:
 *   POST   /api/admin/products/[id]/lots                     create a lot
 *   PATCH  /api/admin/products/[id]/lots/[lotId]/results     save entered results
 *   POST   /api/admin/products/[id]/lots/[lotId]/results?action=verify
 *
 * Nothing is generated here. Verification is a deliberate, per-lot action gated by
 * the database on having a lab, a test date, a purity figure, and the signed file.
 */

export interface EditorLot {
  id: string;
  lot_number: string;
  test_date: string | null;
  purity_pct: number | null;
  purity_method: string | null;
  hplc_column: string | null;
  hplc_wavelength_nm: number | null;
  ms_method: string | null;
  ms_observed_mass_da: number | null;
  ms_theoretical_mass_da: number | null;
  water_content_pct: number | null;
  net_peptide_content_pct: number | null;
  appearance: string | null;
  testing_lab: string | null;
  lab_report_number: string | null;
  lab_is_third_party: boolean | null;
  lab_accreditation: string | null;
  coa_storage_key: string | null;
  coa_verified_at: string | null;
  coa_retracted_at: string | null;
}

type FieldValue = string;

const RESULT_FIELDS: Array<{ key: keyof EditorLot; label: string; kind: 'text' | 'number' | 'date' }> = [
  { key: 'test_date', label: 'Test Date', kind: 'date' },
  { key: 'purity_pct', label: 'Purity Percent', kind: 'number' },
  { key: 'purity_method', label: 'Purity Method', kind: 'text' },
  { key: 'hplc_column', label: 'HPLC Column', kind: 'text' },
  { key: 'hplc_wavelength_nm', label: 'Detection Wavelength (nm)', kind: 'number' },
  { key: 'ms_method', label: 'Mass Spec Method', kind: 'text' },
  { key: 'ms_observed_mass_da', label: 'Observed Mass (Da)', kind: 'number' },
  { key: 'ms_theoretical_mass_da', label: 'Theoretical Mass (Da)', kind: 'number' },
  { key: 'water_content_pct', label: 'Water Content Percent', kind: 'number' },
  { key: 'net_peptide_content_pct', label: 'Net Peptide Content Percent', kind: 'number' },
  { key: 'appearance', label: 'Appearance', kind: 'text' },
  { key: 'testing_lab', label: 'Testing Laboratory', kind: 'text' },
  { key: 'lab_report_number', label: 'Laboratory Report Number', kind: 'text' },
  { key: 'lab_accreditation', label: 'Laboratory Accreditation', kind: 'text' },
];

function toStr(v: unknown): FieldValue {
  if (v === null || v === undefined) return '';
  return String(v);
}

export default function AdminCoaEditor({
  productId,
  initialLots,
}: {
  productId: string;
  initialLots: EditorLot[];
}) {
  const [lots, setLots] = useState<EditorLot[]>(initialLots);
  const [activeId, setActiveId] = useState<string | null>(initialLots[0]?.id ?? null);
  const [newLotNumber, setNewLotNumber] = useState('');
  const [form, setForm] = useState<Record<string, FieldValue>>(() =>
    buildForm(initialLots[0] ?? null),
  );
  const [thirdParty, setThirdParty] = useState<string>(
    initialLots[0]?.lab_is_third_party === null || initialLots[0] === undefined
      ? ''
      : initialLots[0].lab_is_third_party
        ? 'yes'
        : 'no',
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const active = lots.find((l) => l.id === activeId) ?? null;
  const isVerified = !!active?.coa_verified_at;

  function buildForm(lot: EditorLot | null): Record<string, FieldValue> {
    const f: Record<string, FieldValue> = {};
    for (const { key } of RESULT_FIELDS) f[key as string] = toStr(lot?.[key]);
    return f;
  }

  function selectLot(id: string) {
    const lot = lots.find((l) => l.id === id) ?? null;
    setActiveId(id);
    setForm(buildForm(lot));
    setThirdParty(
      lot?.lab_is_third_party === null || lot === null
        ? ''
        : lot.lab_is_third_party
          ? 'yes'
          : 'no',
    );
    setMessage(null);
  }

  async function createLot() {
    const lot_number = newLotNumber.trim();
    if (!lot_number) {
      setMessage({ kind: 'err', text: 'Enter A Lot Number.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/lots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lot_number }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could Not Create Lot.');
      const lot = json.lot as EditorLot;
      setLots((prev) => [lot, ...prev]);
      setNewLotNumber('');
      selectLot(lot.id);
      setMessage({ kind: 'ok', text: 'Lot Created. Enter Its Results Below.' });
    } catch (e) {
      setMessage({ kind: 'err', text: e instanceof Error ? e.message : 'Could Not Create Lot.' });
    } finally {
      setBusy(false);
    }
  }

  async function saveResults() {
    if (!active) return;
    setBusy(true);
    setMessage(null);

    const body: Record<string, unknown> = {};
    for (const { key, kind } of RESULT_FIELDS) {
      const raw = form[key as string]?.trim() ?? '';
      if (raw === '') {
        body[key as string] = null;
      } else if (kind === 'number') {
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          setBusy(false);
          setMessage({ kind: 'err', text: `${key} Must Be A Number.` });
          return;
        }
        body[key as string] = n;
      } else {
        body[key as string] = raw;
      }
    }
    if (thirdParty === 'yes') body.lab_is_third_party = true;
    else if (thirdParty === 'no') body.lab_is_third_party = false;
    else body.lab_is_third_party = null;

    try {
      const res = await fetch(`/api/admin/products/${productId}/lots/${active.id}/results`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could Not Save Results.');
      const lot = json.lot as EditorLot;
      setLots((prev) => prev.map((l) => (l.id === lot.id ? lot : l)));
      setMessage({ kind: 'ok', text: 'Results Saved.' });
    } catch (e) {
      setMessage({ kind: 'err', text: e instanceof Error ? e.message : 'Could Not Save Results.' });
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!active) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/lots/${active.id}/results?action=verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could Not Verify.');
      const lot = json.lot as EditorLot;
      setLots((prev) => prev.map((l) => (l.id === lot.id ? lot : l)));
      setMessage({ kind: 'ok', text: 'Certificate Verified And Now Public.' });
    } catch (e) {
      setMessage({ kind: 'err', text: e instanceof Error ? e.message : 'Could Not Verify.' });
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem 0.65rem',
    background: '#0F1923',
    border: '1px solid #1D2D3E',
    borderRadius: 6,
    color: '#FFFFFF',
    fontSize: '0.9rem',
  };

  return (
    <div>
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '0.75rem' }}>Lots</h2>
        {lots.length === 0 && (
          <p style={{ color: '#A8B4C0', fontSize: '0.9rem' }}>No Lots Yet. Create One To Begin.</p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {lots.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => selectLot(l.id)}
              className={l.id === activeId ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}
            >
              {l.lot_number}
              {l.coa_retracted_at ? ' (Retracted)' : l.coa_verified_at ? ' (Verified)' : ' (Draft)'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            value={newLotNumber}
            onChange={(e) => setNewLotNumber(e.target.value)}
            placeholder="New Lot Number"
            maxLength={64}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="button" className="btn-secondary" onClick={createLot} disabled={busy} style={{ padding: '0.5rem 1rem' }}>
            Create Lot
          </button>
        </div>
      </div>

      {active && (
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1rem', margin: 0 }}>
              Results For Lot {active.lot_number}
            </h2>
            {isVerified && (
              <span style={{ color: '#3DD9A4', fontSize: '0.85rem' }}>Verified And Frozen</span>
            )}
          </div>

          {isVerified ? (
            <p style={{ color: '#A8B4C0', fontSize: '0.9rem', lineHeight: 1.6 }}>
              This Certificate Is Verified And Its Values Are Frozen. To Correct It, Retract It And
              Publish A New Lot.
            </p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                {RESULT_FIELDS.map(({ key, label, kind }) => (
                  <label key={key as string} style={{ fontSize: '0.8rem', color: '#A8B4C0' }}>
                    {label}
                    <input
                      type={kind === 'date' ? 'date' : kind === 'number' ? 'number' : 'text'}
                      step={kind === 'number' ? 'any' : undefined}
                      value={form[key as string] ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, [key as string]: e.target.value }))}
                      style={{ ...inputStyle, marginTop: 4 }}
                    />
                  </label>
                ))}
                <label style={{ fontSize: '0.8rem', color: '#A8B4C0' }}>
                  Independent Third Party
                  <select
                    value={thirdParty}
                    onChange={(e) => setThirdParty(e.target.value)}
                    style={{ ...inputStyle, marginTop: 4 }}
                  >
                    <option value="">Not Reported</option>
                    <option value="yes">Yes</option>
                    <option value="no">No, Tested In-House</option>
                  </select>
                </label>
              </div>

              <p style={{ color: '#6B7A8A', fontSize: '0.8rem', marginTop: '0.85rem', lineHeight: 1.5 }}>
                Note: Verifying Also Requires The Signed Certificate File Uploaded To The Lot, Plus A
                Testing Laboratory, Test Date, And Purity. Upload The Signed PDF On The Lot Screen.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={saveResults} disabled={busy} style={{ padding: '0.6rem 1.25rem' }}>
                  Save Results
                </button>
                <button type="button" className="btn-primary" onClick={verify} disabled={busy} style={{ padding: '0.6rem 1.25rem' }}>
                  Verify And Publish
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {message && (
        <p style={{ marginTop: '1rem', color: message.kind === 'ok' ? '#3DD9A4' : '#E53E3E', fontSize: '0.9rem' }}>
          {message.text}
        </p>
      )}
    </div>
  );
}
