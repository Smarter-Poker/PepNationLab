'use client';

import { useEffect, useMemo, useState } from 'react';
import CertificateDocument, { type CertificateData } from '@/components/coa/CertificateDocument';

/**
 * Admin editor for real Certificate Of Analysis results, with a live preview.
 *
 * The preview at the top renders exactly how the published certificate will look
 * (no SAMPLE stamp, no watermark) and updates as the admin types. It never
 * fabricates data: any field left blank renders as "Not Reported". A certificate
 * only becomes public when the admin publishes (verifies) it, which the database
 * gates on a real lab, test date, and purity.
 *
 * All writes go through the existing admin-gated, CSRF-checked routes:
 *   POST   /api/admin/products/[id]/lots                     create a lot
 *   PATCH  /api/admin/products/[id]/lots/[lotId]/results     save entered results
 *   POST   /api/admin/products/[id]/lots/[lotId]/results?action=verify
 */

const LAB_SIGNATORY = 'Swadep Mirsha';
const LAB_SIGNATORY_TITLE = 'Laboratory Technician';

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
  storage: string | null;
  testing_lab: string | null;
  lab_report_number: string | null;
  lab_is_third_party: boolean | null;
  lab_accreditation: string | null;
  coa_storage_key: string | null;
  coa_verified_at: string | null;
  coa_retracted_at: string | null;
}

type Kind = 'text' | 'number' | 'date';

const LOT_FIELD = { key: 'lot_number', label: 'Lot Number', kind: 'text' as Kind };

const RESULT_FIELDS: Array<{ key: keyof EditorLot; label: string; kind: Kind }> = [
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
  { key: 'storage', label: 'Storage (Fahrenheit)', kind: 'text' },
  { key: 'testing_lab', label: 'Testing Laboratory', kind: 'text' },
  { key: 'lab_report_number', label: 'Laboratory Report Number', kind: 'text' },
  { key: 'lab_accreditation', label: 'Laboratory Accreditation', kind: 'text' },
];

const ALL_FIELDS = [LOT_FIELD, ...RESULT_FIELDS];

function toStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function num(v: string): number | null {
  const t = v.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function AdminCoaEditor({
  productId,
  productName,
  referenceMassDa,
  sequenceOneLetter,
  appUrl,
  initialLots,
}: {
  productId: string;
  productName: string;
  referenceMassDa: number | null;
  sequenceOneLetter: string | null;
  appUrl: string;
  initialLots: EditorLot[];
}) {
  const [lots, setLots] = useState<EditorLot[]>(initialLots);
  const [activeId, setActiveId] = useState<string | null>(initialLots[0]?.id ?? null);
  const [newLotNumber, setNewLotNumber] = useState('');
  const [form, setForm] = useState<Record<string, string>>(() => buildForm(initialLots[0] ?? null));
  const [thirdParty, setThirdParty] = useState<string>(thirdPartyOf(initialLots[0] ?? null));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const active = lots.find((l) => l.id === activeId) ?? null;
  const isVerified = !!active?.coa_verified_at;

  function buildForm(lot: EditorLot | null): Record<string, string> {
    const f: Record<string, string> = {};
    for (const { key } of ALL_FIELDS) f[key as string] = toStr(lot?.[key as keyof EditorLot]);
    return f;
  }
  function thirdPartyOf(lot: EditorLot | null): string {
    if (!lot || lot.lab_is_third_party === null) return '';
    return lot.lab_is_third_party ? 'yes' : 'no';
  }

  function selectLot(id: string) {
    const lot = lots.find((l) => l.id === id) ?? null;
    setActiveId(id);
    setForm(buildForm(lot));
    setThirdParty(thirdPartyOf(lot));
    setMessage(null);
  }

  // Generate the verification QR for the active lot. The URL is permanent; it
  // resolves once the certificate is published.
  useEffect(() => {
    let cancelled = false;
    if (!active) {
      setQrDataUrl(null);
      return;
    }
    const url = `${appUrl}/coa/${active.id}/certificate`;
    import('qrcode')
      .then((QR) => QR.toDataURL(url, { color: { dark: '#0F1923', light: '#FFFFFF' }, width: 256, errorCorrectionLevel: 'M' }))
      .then((d) => {
        if (!cancelled) setQrDataUrl(d);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [active, appUrl]);

  // Live certificate data assembled from the current form values.
  const preview: CertificateData = useMemo(() => {
    return {
      lotNumber: form.lot_number || 'Lot Number',
      productName,
      reportNumber: form.lab_report_number || null,
      testDate: form.test_date || null,
      appearance: form.appearance || null,
      storage: form.storage || null,
      purityPct: num(form.purity_pct),
      purityMethod: form.purity_method || null,
      hplcColumn: form.hplc_column || null,
      hplcWavelengthNm: num(form.hplc_wavelength_nm),
      msMethod: form.ms_method || null,
      msObservedMassDa: num(form.ms_observed_mass_da),
      msTheoreticalMassDa: num(form.ms_theoretical_mass_da),
      referenceMassDa,
      sequenceOneLetter,
      waterContentPct: num(form.water_content_pct),
      netPeptideContentPct: num(form.net_peptide_content_pct),
      testingLab: form.testing_lab || null,
      labIsThirdParty: thirdParty === 'yes' ? true : thirdParty === 'no' ? false : null,
      labAccreditation: form.lab_accreditation || null,
      approvedByName: LAB_SIGNATORY,
      approvedByTitle: LAB_SIGNATORY_TITLE,
      verifiedAt: active?.coa_verified_at ?? null,
      qrDataUrl,
      chromatogramUrl: null,
      verified: isVerified,
      adminPreview: true,
    };
  }, [form, thirdParty, productName, referenceMassDa, sequenceOneLetter, qrDataUrl, active, isVerified]);

  async function createLot() {
    const lot_number = newLotNumber.trim();
    if (!lot_number) return setMessage({ kind: 'err', text: 'Enter A Lot Number.' });
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
      setMessage({ kind: 'ok', text: 'Lot Created.' });
    } catch (e) {
      setMessage({ kind: 'err', text: e instanceof Error ? e.message : 'Could Not Create Lot.' });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!active) return;
    setBusy(true);
    setMessage(null);

    // Lot number change goes to the lot route; results go to the results route.
    const lotNumberChanged = form.lot_number.trim() && form.lot_number.trim() !== active.lot_number;

    const body: Record<string, unknown> = {};
    for (const { key, kind } of RESULT_FIELDS) {
      const raw = (form[key as string] ?? '').trim();
      if (raw === '') body[key as string] = null;
      else if (kind === 'number') {
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          setBusy(false);
          return setMessage({ kind: 'err', text: `${key} Must Be A Number.` });
        }
        body[key as string] = n;
      } else body[key as string] = raw;
    }
    body.lab_is_third_party = thirdParty === 'yes' ? true : thirdParty === 'no' ? false : null;

    try {
      if (lotNumberChanged) {
        const r = await fetch(`/api/admin/products/${productId}/lots/${active.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lot_number: form.lot_number.trim() }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || 'Could Not Update Lot Number.');
      }
      const res = await fetch(`/api/admin/products/${productId}/lots/${active.id}/results`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could Not Save.');
      const lot = { ...(json.lot as EditorLot), lot_number: form.lot_number.trim() || active.lot_number };
      setLots((prev) => prev.map((l) => (l.id === lot.id ? lot : l)));
      setMessage({ kind: 'ok', text: 'Saved.' });
    } catch (e) {
      setMessage({ kind: 'err', text: e instanceof Error ? e.message : 'Could Not Save.' });
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!active) return;
    setBusy(true);
    setMessage(null);
    try {
      // Save first so the latest edits are persisted, then verify.
      await save();
      const res = await fetch(`/api/admin/products/${productId}/lots/${active.id}/results?action=verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could Not Publish.');
      const lot = json.lot as EditorLot;
      setLots((prev) => prev.map((l) => (l.id === lot.id ? lot : l)));
      setMessage({ kind: 'ok', text: 'Published. This Certificate Is Now Public.' });
    } catch (e) {
      setMessage({ kind: 'err', text: e instanceof Error ? e.message : 'Could Not Publish.' });
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
    marginTop: 4,
  };

  return (
    <div>
      <div style={{ marginBottom: '0.75rem', color: isVerified ? '#3DD9A4' : '#E8C15A', fontSize: '0.85rem' }}>
        {isVerified ? 'Published. Live Preview Below.' : 'Draft. Live Preview Of The Published Layout Below.'}
      </div>

      <div style={{ marginBottom: '1.75rem' }}>
        <CertificateDocument data={preview} />
      </div>

      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: lots.length ? '0.75rem' : 0 }}>
          {lots.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => selectLot(l.id)}
              className={l.id === activeId ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
            >
              {l.lot_number}
              {l.coa_retracted_at ? ' (Retracted)' : l.coa_verified_at ? ' (Published)' : ' (Draft)'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            value={newLotNumber}
            onChange={(e) => setNewLotNumber(e.target.value)}
            placeholder="Add Another Lot Number"
            maxLength={64}
            style={{ ...inputStyle, flex: 1, marginTop: 0 }}
          />
          <button type="button" className="btn-secondary" onClick={createLot} disabled={busy} style={{ padding: '0.5rem 1rem' }}>
            Add Lot
          </button>
        </div>
      </div>

      {active && (
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          {isVerified ? (
            <p style={{ color: '#A8B4C0', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
              This Certificate Is Published And Its Values Are Frozen. To Change It, Add A New Lot And
              Publish That Instead.
            </p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                {ALL_FIELDS.map(({ key, label, kind }) => (
                  <label key={key as string} style={{ fontSize: '0.8rem', color: '#A8B4C0' }}>
                    {label}
                    <input
                      type={kind === 'date' ? 'date' : kind === 'number' ? 'number' : 'text'}
                      step={kind === 'number' ? 'any' : undefined}
                      value={form[key as string] ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, [key as string]: e.target.value }))}
                      style={inputStyle}
                    />
                  </label>
                ))}
                <label style={{ fontSize: '0.8rem', color: '#A8B4C0' }}>
                  Independent Third Party
                  <select value={thirdParty} onChange={(e) => setThirdParty(e.target.value)} style={inputStyle}>
                    <option value="">Not Reported</option>
                    <option value="yes">Yes</option>
                    <option value="no">No, Tested In-House</option>
                  </select>
                </label>
              </div>

              <p style={{ color: '#6B7A8A', fontSize: '0.8rem', marginTop: '0.85rem', lineHeight: 1.5 }}>
                Publishing Requires A Testing Laboratory, A Test Date, And A Reported Purity. Enter The
                Real Laboratory Readings; Blank Fields Publish As Not Reported.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={save} disabled={busy} style={{ padding: '0.6rem 1.25rem' }}>
                  Save Draft
                </button>
                <button type="button" className="btn-primary" onClick={publish} disabled={busy} style={{ padding: '0.6rem 1.25rem' }}>
                  Publish
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
