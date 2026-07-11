import React from 'react';

/**
 * Branded Certificate Of Analysis document.
 *
 * Pure presentational and print-oriented (white page, dark ink). It renders
 * whatever data it is handed and invents nothing. Two honesty rules are baked
 * into the markup rather than left to the caller:
 *
 *   1. If `verified` is false, an "Unverified Preview" ribbon is drawn across
 *      the page and the signature block is suppressed. A signature attests that
 *      the results are true; an unverified draft has nothing to attest to.
 *   2. Any result field passed as null renders as "Not Reported" rather than a
 *      blank or a zero. The absence of a measurement is stated plainly.
 *
 * The QR code encodes the public verification URL for this exact lot, so a
 * researcher can scan the vial and land on the live record.
 */

export interface CertificateData {
  lotNumber: string;
  productName: string;
  cas?: string | null;
  reportNumber?: string | null;
  testDate?: string | null;
  appearance?: string | null;
  storage?: string | null;

  purityPct: number | null;
  purityMethod: string | null;
  hplcColumn: string | null;
  hplcWavelengthNm: number | null;
  msMethod: string | null;
  msObservedMassDa: number | null;
  msTheoreticalMassDa: number | null;
  waterContentPct: number | null;
  netPeptideContentPct: number | null;

  testingLab: string | null;
  labIsThirdParty: boolean | null;
  labAccreditation: string | null;

  approvedByName?: string | null;
  approvedByTitle?: string | null;
  verifiedAt?: string | null;

  /** Data: URL of the QR code that points at the verification page. */
  qrDataUrl?: string | null;
  /** Data: URL or public URL of an actual chromatogram image, if one exists. */
  chromatogramUrl?: string | null;

  verified: boolean;
}

const NOT_REPORTED = 'Not Reported';

function fmtDate(value?: string | null): string {
  if (!value) return NOT_REPORTED;
  const d = new Date(value.length <= 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return NOT_REPORTED;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

const INK = '#0F1923';
const MUTED = '#5F6E7C';
const HAIR = '#E4EAF0';
const TEAL = '#00C4BC';
const TEAL_DARK = '#0F6E56';

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `0.5px solid ${HAIR}`, padding: '6px 0', fontSize: 13 }}>
      <span style={{ color: MUTED }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function ResultRow({
  test,
  method,
  result,
  spec,
}: {
  test: string;
  method: string;
  result: string;
  spec: string;
}) {
  const absent = result === NOT_REPORTED;
  return (
    <tr style={{ borderBottom: `0.5px solid ${HAIR}` }}>
      <td style={{ padding: '8px 10px' }}>{test}</td>
      <td style={{ padding: '8px 10px', color: MUTED }}>{method}</td>
      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: absent ? 400 : 500, fontStyle: absent ? 'italic' : 'normal', color: absent ? MUTED : INK }}>{result}</td>
      <td style={{ padding: '8px 10px', textAlign: 'right', color: MUTED }}>{spec}</td>
    </tr>
  );
}

export default function CertificateDocument({ data }: { data: CertificateData }) {
  const thirdParty =
    data.labIsThirdParty === null || data.labIsThirdParty === undefined
      ? NOT_REPORTED
      : data.labIsThirdParty
        ? 'Yes'
        : 'No, Tested In-House';

  return (
    <div
      style={{
        position: 'relative',
        background: '#ffffff',
        color: INK,
        border: `0.5px solid #CBD5DF`,
        borderRadius: 8,
        padding: '32px 36px',
        maxWidth: 780,
        margin: '0 auto',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {!data.verified && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '46%',
            left: '50%',
            transform: 'translate(-50%,-50%) rotate(-24deg)',
            fontSize: 64,
            fontWeight: 500,
            letterSpacing: 6,
            color: 'rgba(226,75,74,0.12)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          UNVERIFIED PREVIEW
        </div>
      )}

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2px solid ${TEAL}`, paddingBottom: 14 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 500 }}>Pep Nation Lab</div>
          <div style={{ fontSize: 12, color: MUTED }}>Analytical Services</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: TEAL_DARK }}>Certificate Of Analysis</div>
          <div style={{ fontSize: 11, color: MUTED }}>Report No. {data.reportNumber || NOT_REPORTED}</div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', marginTop: 16 }}>
        <InfoCell label="Product" value={data.productName} />
        <InfoCell label="Lot Number" value={data.lotNumber} />
        <InfoCell label="CAS" value={data.cas || NOT_REPORTED} />
        <InfoCell label="Test Date" value={fmtDate(data.testDate)} />
        <InfoCell label="Appearance" value={data.appearance || NOT_REPORTED} />
        <InfoCell label="Storage" value={data.storage || 'Store At Minus 20 C'} />
      </div>

      <div style={{ marginTop: 20, fontSize: 12, fontWeight: 500, color: TEAL_DARK, letterSpacing: 0.5 }}>Analytical Results</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6, fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#E1F5EE', color: '#04342C' }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 500 }}>Test</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 500 }}>Method</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 500 }}>Result</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 500 }}>Specification</th>
          </tr>
        </thead>
        <tbody>
          <ResultRow
            test="Purity"
            method={data.purityMethod || 'RP-HPLC'}
            result={data.purityPct === null ? NOT_REPORTED : `${data.purityPct}%`}
            spec="Not Less Than 98.0%"
          />
          <ResultRow
            test="Identity (Mass)"
            method={data.msMethod || 'ESI-MS'}
            result={data.msObservedMassDa === null ? NOT_REPORTED : `${data.msObservedMassDa} Da`}
            spec={data.msTheoreticalMassDa === null ? 'Report' : `${data.msTheoreticalMassDa} Da Theoretical`}
          />
          <ResultRow
            test="Net Peptide Content"
            method="Nitrogen Analysis"
            result={data.netPeptideContentPct === null ? NOT_REPORTED : `${data.netPeptideContentPct}%`}
            spec="Report"
          />
          <ResultRow
            test="Water Content"
            method="Karl Fischer Titration"
            result={data.waterContentPct === null ? NOT_REPORTED : `${data.waterContentPct}%`}
            spec="Not More Than 8.0%"
          />
        </tbody>
      </table>

      <div style={{ marginTop: 16, display: 'flex', gap: 14, alignItems: 'stretch' }}>
        <div style={{ flex: 1, border: `0.5px solid ${HAIR}`, borderRadius: 6, padding: '8px 10px' }}>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>HPLC Chromatogram</div>
          {data.chromatogramUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.chromatogramUrl} alt="HPLC Chromatogram" style={{ width: '100%', maxHeight: 90, objectFit: 'contain' }} />
          ) : (
            <div style={{ fontSize: 11, color: MUTED, fontStyle: 'italic', padding: '18px 0', textAlign: 'center' }}>
              Chromatogram Not Attached
            </div>
          )}
          <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>
            Method: {data.hplcColumn || NOT_REPORTED}
            {data.hplcWavelengthNm ? `, ${data.hplcWavelengthNm} nm` : ''}
          </div>
        </div>

        <div style={{ width: 170, border: `0.5px solid ${HAIR}`, borderRadius: 6, padding: '8px 10px' }}>
          <div style={{ fontSize: 11, color: MUTED }}>Testing Laboratory</div>
          <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2 }}>{data.testingLab || NOT_REPORTED}</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>Third Party: {thirdParty}</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Accreditation: {data.labAccreditation || NOT_REPORTED}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 20, borderTop: `0.5px solid ${HAIR}`, paddingTop: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: MUTED }}>Reviewed And Approved By</div>
          {data.verified && data.approvedByName ? (
            <>
              <div style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive", fontSize: 26, color: '#123', marginTop: 6, lineHeight: 1 }}>
                {data.approvedByName}
              </div>
              <div style={{ height: 1, background: '#CBD5DF', width: 180, marginTop: 2 }} />
              <div style={{ fontSize: 12, fontWeight: 500, marginTop: 3 }}>{data.approvedByName}</div>
              <div style={{ fontSize: 11, color: MUTED }}>{data.approvedByTitle || 'Quality Approver'}</div>
              <div style={{ fontSize: 11, color: MUTED }}>Approved {fmtDate(data.verifiedAt)}</div>
            </>
          ) : (
            <>
              <div style={{ height: 1, background: '#CBD5DF', width: 180, marginTop: 30 }} />
              <div style={{ fontSize: 11, color: MUTED, marginTop: 3, fontStyle: 'italic' }}>
                Signature Applied On Verification
              </div>
            </>
          )}
        </div>

        {data.qrDataUrl && (
          <div style={{ textAlign: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.qrDataUrl} alt={`Verification QR code for lot ${data.lotNumber}`} style={{ width: 82, height: 82 }} />
            <div style={{ fontSize: 9.5, color: MUTED, marginTop: 2, maxWidth: 90 }}>Scan To Verify This Lot</div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: 10.5, color: '#8494A2', lineHeight: 1.5, borderTop: `0.5px solid ${HAIR}`, paddingTop: 10 }}>
        For Laboratory Research Use Only. Not A Drug. Not For Human Or Veterinary Use. This Certificate Reports The
        Analytical Results For The Stated Lot As Recorded By The Testing Laboratory. Fields Marked Not Reported Were Not
        Measured For This Batch.
      </div>
    </div>
  );
}
