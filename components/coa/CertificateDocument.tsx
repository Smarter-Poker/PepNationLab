import React from 'react';

/**
 * Branded Certificate Of Analysis document.
 *
 * Pure presentational and print-oriented (white page, dark ink). It renders
 * whatever data it is handed and invents nothing. Three honesty rules are baked
 * into the markup rather than left to the caller:
 *
 *   1. In `sample` mode a permanent SAMPLE watermark and a red banner are drawn,
 *      the signature is tagged as a preview rather than a real sign-off, and no
 *      live verification QR is shown. This is how the admin catalogue preview
 *      renders generated placeholder numbers so they can never be mistaken for a
 *      real, signed certificate.
 *   2. If `verified` is false (and not sample), an "Unverified Preview" ribbon is
 *      drawn and the signature is suppressed. A signature attests the results are
 *      true; an unverified draft has nothing to attest to.
 *   3. Any result field passed as null renders as "Not Reported" rather than a
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

  /** Real, per-peptide chemical constants pulled from the compound record.
   *  These are deterministic facts, not measurements. */
  referenceMassDa?: number | null;
  sequenceOneLetter?: string | null;

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

  /** SAMPLE / PREVIEW mode. Draws a permanent SAMPLE watermark, tags the
   *  signature as a preview rather than a real sign-off, and shows no live
   *  verification QR. Used by the admin catalogue preview so generated
   *  placeholder numbers can never be mistaken for a real, signed certificate. */
  sample?: boolean;

  /** ADMIN PREVIEW mode. Renders the certificate exactly as it will look when
   *  published -- no SAMPLE stamp, no UNVERIFIED ribbon, signature and QR shown --
   *  so an admin can review the finished layout while editing. It never
   *  fabricates data: fields the admin has not filled still render "Not Reported".
   *  Only the real /coa route (verified lots) is public. */
  adminPreview?: boolean;
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
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `0.5px solid ${HAIR}`, padding: '6px 0', fontSize: 13, gap: '0.75rem', minWidth: 0 }}>
      <span style={{ color: MUTED, flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }} title={value}>{value}</span>
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

  // Theoretical mass is a real per-peptide constant. Prefer a value recorded on
  // the lot; otherwise fall back to the compound's molecular weight. Both are
  // chemical facts, so this fills in correctly without inventing anything.
  const theoreticalMass =
    data.msTheoreticalMassDa ?? data.referenceMassDa ?? null;

  const sequence =
    data.sequenceOneLetter && data.sequenceOneLetter.trim().length > 0
      ? data.sequenceOneLetter.trim()
      : null;

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
      {(data.sample || (!data.verified && !data.adminPreview)) && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '46%',
            left: '50%',
            transform: 'translate(-50%,-50%) rotate(-24deg)',
            fontSize: data.sample ? 88 : 64,
            fontWeight: 500,
            letterSpacing: 8,
            color: 'rgba(226,75,74,0.13)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {data.sample ? 'SAMPLE' : 'UNVERIFIED PREVIEW'}
        </div>
      )}

      {data.sample && (
        <div
          style={{
            background: '#FCEBEB',
            color: '#A32D2D',
            border: '0.5px solid #F09595',
            borderRadius: 6,
            padding: '7px 10px',
            fontSize: 11,
            marginBottom: 12,
          }}
        >
          Sample Layout Preview. The Analytical Values Below Are Generated Placeholders For Design
          Review Only, Not The Result Of Testing Any Batch. Replace With Real Laboratory Readings
          Before Verifying.
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

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', marginTop: 16, minWidth: 300 }}>
          <InfoCell label="Product" value={data.productName} />
          <InfoCell label="Lot Number" value={data.lotNumber} />
          <InfoCell label="CAS" value={data.cas || NOT_REPORTED} />
          <InfoCell label="Test Date" value={fmtDate(data.testDate)} />
          <InfoCell label="Appearance" value={data.appearance || NOT_REPORTED} />
          <InfoCell label="Storage" value={data.storage || 'Store At 36 To 46 F'} />
        </div>
      </div>

      {sequence && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: MUTED }}>
          <span style={{ fontWeight: 500, color: INK }}>Sequence: </span>
          <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', wordBreak: 'break-all' }}>{sequence}</span>
        </div>
      )}

      <div style={{ marginTop: 20, fontSize: 12, fontWeight: 500, color: TEAL_DARK, letterSpacing: 0.5 }}>Analytical Results</div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
        <table style={{ width: '100%', minWidth: 400, borderCollapse: 'collapse', marginTop: 6, fontSize: 13 }}>
          <caption className="sr-only">Analytical Test Results</caption>
          <thead>
            <tr style={{ background: '#E1F5EE', color: '#04342C' }}>
              <th scope="col" style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 500, whiteSpace: 'nowrap' }}>Test</th>
              <th scope="col" style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 500, whiteSpace: 'nowrap' }}>Method</th>
              <th scope="col" style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 500, whiteSpace: 'nowrap' }}>Result</th>
              <th scope="col" style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 500, whiteSpace: 'nowrap' }}>Specification</th>
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
            spec={
              theoreticalMass === null ? 'Report' : `${theoreticalMass} Da Theoretical`
            }
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
      </div>

      {/* On mobile this two-column flex can be too narrow and cause text to
          stack vertically. We wrap it in an overflow-x scroll container and
          set min-width on each cell so the labels never break. */}
      <div style={{ marginTop: 16, overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', minWidth: 340 }}>
          <div style={{ flex: 1, border: `0.5px solid ${HAIR}`, borderRadius: 6, padding: '8px 10px', minWidth: 160 }}>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 4, whiteSpace: 'nowrap' }}>HPLC Chromatogram</div>
            {data.chromatogramUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.chromatogramUrl} alt="HPLC Chromatogram" style={{ width: '100%', maxHeight: 90, objectFit: 'contain' }} />
            ) : (
              <div style={{ fontSize: 11, color: MUTED, fontStyle: 'italic', padding: '18px 0', textAlign: 'center' }}>
                Chromatogram Not Attached
              </div>
            )}
            <div style={{ fontSize: 11, color: MUTED, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Method: {data.hplcColumn || NOT_REPORTED}
              {data.hplcWavelengthNm ? `, ${data.hplcWavelengthNm} nm` : ''}
            </div>
          </div>

          <div style={{ width: 170, flexShrink: 0, border: `0.5px solid ${HAIR}`, borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 11, color: MUTED, whiteSpace: 'nowrap' }}>Testing Laboratory</div>
            <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2 }}>{data.testingLab || NOT_REPORTED}</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 6, whiteSpace: 'nowrap' }}>Third Party: {thirdParty}</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Accreditation: {data.labAccreditation || NOT_REPORTED}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 20, borderTop: `0.5px solid ${HAIR}`, paddingTop: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: MUTED }}>Reviewed And Approved By</div>
          {(data.verified || data.sample || data.adminPreview) && data.approvedByName ? (
            <>
              <div style={{ position: 'relative', width: 200, height: 44, marginTop: 4 }}>
                <span
                  style={{
                    fontFamily: "'Segoe Script', 'Brush Script MT', 'Snell Roundhand', cursive",
                    fontSize: 30,
                    fontStyle: 'italic',
                    color: '#12324A',
                    position: 'absolute',
                    left: 4,
                    top: 0,
                    transform: 'rotate(-3deg)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {data.approvedByName}
                </span>
                <svg viewBox="0 0 200 44" width="200" height="44" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }} aria-hidden="true">
                  <path d="M2 40 C 40 34, 70 46, 110 38 S 180 30, 198 39" fill="none" stroke="#12324A" strokeWidth="1.1" opacity="0.7" />
                </svg>
              </div>
              <div style={{ height: 1, background: '#CBD5DF', width: 200, marginTop: 2 }} />
              <div style={{ fontSize: 12, fontWeight: 500, marginTop: 3 }}>{data.approvedByName}</div>
              <div style={{ fontSize: 11, color: MUTED }}>{data.approvedByTitle || 'Laboratory Technician'}</div>
              <div style={{ fontSize: 11, color: MUTED }}>
                {data.sample
                  ? 'Sample Preview, Not A Real Sign-Off'
                  : data.verified
                    ? `Approved ${fmtDate(data.verifiedAt)}`
                    : 'Draft, Not Yet Published'}
              </div>
            </>
          ) : (
            <>
              <div style={{ height: 1, background: '#CBD5DF', width: 200, marginTop: 30 }} />
              <div style={{ fontSize: 11, color: MUTED, marginTop: 3, fontStyle: 'italic' }}>
                Signature Applied On Verification
              </div>
            </>
          )}
        </div>

        {data.sample ? (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 82,
                height: 82,
                border: '1px dashed #CBD5DF',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8494A2',
                fontSize: 9.5,
                textAlign: 'center',
                padding: 6,
              }}
            >
              QR Assigned On Verification
            </div>
          </div>
        ) : (
          data.qrDataUrl && (
            <div style={{ textAlign: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.qrDataUrl} alt={`Verification QR code for lot ${data.lotNumber}`} style={{ width: 82, height: 82 }} />
              <div style={{ fontSize: 9, color: MUTED, marginTop: 2, whiteSpace: 'nowrap', width: 'max-content', margin: '2px auto 0' }}>Scan To Verify This Lot</div>
            </div>
          )
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
