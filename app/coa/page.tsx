import type { Metadata } from 'next';
import Link from 'next/link';
import IframeLink from '@/components/ui/IframeLink';
import { createServiceClient } from '@/lib/supabase/server';
import CoaBackButton from './CoaBackButton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verify A Certificate Of Analysis (COA) | Lot Number Lookup | Pep Nation Lab',
  description:
    'Enter the lot number printed on a vial to view the third-party Certificate Of Analysis for that batch. Verify identity and purity testing. Research Use Only.',
  // Indexable: COA verification is a primary trust/E-E-A-T surface and a real
  // query target. The canonical collapses ?lot= variants; per-lot certificate
  // pages remain noindexed.
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/coa' },
};

interface CoaRow {
  lot_id: string;
  lot_number: string;
  product_name: string;
  product_slug: string;
  supplier: string | null;
  manufactured_at: string | null;
  expires_at: string | null;
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
  chromatogram_storage_key: string | null;
  coa_verified_at: string;
}

const NOT_REPORTED = 'Not Reported';

function formatDate(value: string | null): string {
  if (!value) return NOT_REPORTED;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return NOT_REPORTED;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function Row({ label, value }: { label: string; value: string }) {
  const absent = value === NOT_REPORTED;
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: '1rem',
        padding: '0.75rem 0',
        borderBottom: '1px solid #1D2D3E',
        minWidth: 0,
      }}
    >
      <span style={{ color: '#A8B4C0', flexShrink: 0 }}>{label}</span>
      <span
        style={{
          color: absent ? '#8B98A6' : '#FFFFFF',
          fontStyle: absent ? 'italic' : 'normal',
          textAlign: 'right',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
        }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

/** Compute expiry: use stored expires_at if set; otherwise manufacture + 24 months.
 *  Lyophilized research peptides stored at -20 °C have an industry-standard
 *  shelf life of 24 months from the date of manufacture. */
function computeExpiry(expires_at: string | null, manufactured_at: string | null): string {
  if (expires_at) return formatDate(expires_at);
  if (!manufactured_at) return NOT_REPORTED;
  const mfg = new Date(`${manufactured_at}T00:00:00Z`);
  if (Number.isNaN(mfg.getTime())) return NOT_REPORTED;
  const exp = new Date(mfg);
  exp.setUTCMonth(exp.getUTCMonth() + 24);
  return exp.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export default async function CoaLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ lot?: string }>;
}) {
  const { lot } = await searchParams;
  const query = typeof lot === 'string' ? lot.trim().slice(0, 64) : '';

  let record: CoaRow | null = null;
  let lookupFailed = false;
  let certificateUrl: string | null = null;
  let chromatogramUrl: string | null = null;

  if (query) {
    const supabase = await createServiceClient();
    const { data, error } = await supabase.rpc('lookup_coa_by_lot', { p_lot: query });

    if (error) {
      lookupFailed = true;
    } else {
      record = (data as CoaRow[] | null)?.[0] ?? null;

      if (record?.coa_storage_key) {
        certificateUrl =
          supabase.storage.from('product-coas').getPublicUrl(record.coa_storage_key).data
            ?.publicUrl ?? null;
      }
      if (record?.chromatogram_storage_key) {
        chromatogramUrl =
          supabase.storage.from('product-coas').getPublicUrl(record.chromatogram_storage_key).data
            ?.publicUrl ?? null;
      }
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '3rem 1.25rem 5rem' }}>

      {/* ── Back navigation ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <CoaBackButton />
        {query && record && (
          <Link
            href="/coa"
            style={{
              fontSize: '0.82rem',
              color: '#A8B4C0',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="18 6 6 6" /><path d="M6 6l6 6-6 6" transform="rotate(180 12 12)" /></svg>
            Search Another Lot
          </Link>
        )}
      </div>

      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
        Verify A Certificate Of Analysis
      </h1>
      <p style={{ color: '#A8B4C0', lineHeight: 1.7, marginBottom: '2rem' }}>
        Enter The Lot Number Printed On The Vial. If A Verified Certificate Exists For That Batch,
        The Reported Analytical Results Are Shown Below Exactly As The Testing Laboratory Issued
        Them. All Materials Are Sold For Laboratory Research Use Only.
      </p>

      <form method="get" action="/coa" style={{ display: 'flex', gap: '0.75rem', marginBottom: '2.5rem' }}>
        <label htmlFor="lot" className="sr-only">
          Lot Number
        </label>
        <input
          id="lot"
          name="lot"
          type="text"
          defaultValue={query}
          placeholder="Lot Number"
          maxLength={64}
          autoComplete="off"
          style={{
            flex: 1,
            padding: '0.85rem 1rem',
            background: '#0F1923',
            border: '1px solid #1D2D3E',
            borderRadius: 8,
            color: '#FFFFFF',
          }}
        />
        <button type="submit" className="btn-primary" style={{ padding: '0.85rem 1.5rem' }}>
          Verify
        </button>
      </form>

      {lookupFailed && (
        <div className="card" style={{ padding: '1.5rem', borderColor: '#E53E3E' }}>
          <p style={{ color: '#E53E3E', margin: 0 }}>
            The Lookup Could Not Be Completed. Please Try Again.
          </p>
        </div>
      )}

      {!lookupFailed && query && !record && (
        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginTop: 0, marginBottom: '0.75rem' }}>
            No Verified Certificate Found For Lot {query}
          </h2>
          <p style={{ color: '#A8B4C0', lineHeight: 1.7, margin: 0 }}>
            We Publish A Certificate Only After A Testing Laboratory Has Issued One For That
            Specific Batch And An Administrator Has Confirmed It Against The Signed Document. If
            Nothing Appears Here, No Such Certificate Is On File. Please Check The Lot Number, Or
            Contact Us With A Photograph Of The Vial Label.
          </p>
        </div>
      )}

      {record && (
        <article className="card" style={{ padding: '2rem' }}>
          <header style={{ marginBottom: '1.5rem' }}>
            <p
              style={{
                color: '#00C4BC',
                fontSize: '0.8rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              Verified Certificate Of Analysis
            </p>
            <h2 style={{ fontSize: '1.6rem', margin: '0.35rem 0 0.25rem' }}>{record.product_name}</h2>
            <p style={{ color: '#A8B4C0', margin: 0 }}>Lot {record.lot_number}</p>
          </header>

          <section style={{ marginBottom: '1.75rem' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#D0DAE4', marginBottom: '0.25rem' }}>
              Analytical Results
            </h3>
            <Row
              label="Purity"
              value={record.purity_pct === null ? NOT_REPORTED : `${record.purity_pct}%`}
            />
            <Row label="Purity Method" value={record.purity_method ?? NOT_REPORTED} />
            <Row label="Column" value={record.hplc_column ?? NOT_REPORTED} />
            <Row
              label="Detection Wavelength"
              value={
                record.hplc_wavelength_nm === null ? NOT_REPORTED : `${record.hplc_wavelength_nm} nm`
              }
            />
            <Row label="Mass Spectrometry Method" value={record.ms_method ?? NOT_REPORTED} />
            <Row
              label="Observed Mass"
              value={
                record.ms_observed_mass_da === null ? NOT_REPORTED : `${record.ms_observed_mass_da} Da`
              }
            />
            <Row
              label="Theoretical Mass"
              value={
                record.ms_theoretical_mass_da === null
                  ? NOT_REPORTED
                  : `${record.ms_theoretical_mass_da} Da`
              }
            />
            <Row
              label="Water Content"
              value={record.water_content_pct === null ? NOT_REPORTED : `${record.water_content_pct}%`}
            />
            <Row
              label="Net Peptide Content"
              value={
                record.net_peptide_content_pct === null
                  ? NOT_REPORTED
                  : `${record.net_peptide_content_pct}%`
              }
            />
            <Row label="Appearance" value={record.appearance ?? NOT_REPORTED} />
          </section>

          <section style={{ marginBottom: '1.75rem' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#D0DAE4', marginBottom: '0.25rem' }}>
              Provenance
            </h3>
            <Row label="Testing Laboratory" value={record.testing_lab ?? NOT_REPORTED} />
            <Row label="Laboratory Report Number" value={record.lab_report_number ?? NOT_REPORTED} />
            <Row
              label="Independent Third Party"
              value={
                record.lab_is_third_party === null
                  ? NOT_REPORTED
                  : record.lab_is_third_party
                    ? 'Yes'
                    : 'No, Tested By The Manufacturer'
              }
            />
            <Row label="Laboratory Accreditation" value={record.lab_accreditation ?? NOT_REPORTED} />
            <Row label="Test Date" value={formatDate(record.test_date)} />
            <Row label="Manufactured" value={formatDate(record.manufactured_at)} />
            <Row label="Expires" value={computeExpiry(record.expires_at, record.manufactured_at)} />
          </section>

          <section style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: chromatogramUrl ? '1.5rem' : 0 }}>
            <Link
              href={`/coa/${record.lot_id}/certificate`}
              className="btn-primary"
              style={{ padding: '0.7rem 1.4rem' }}
            >
              View The Branded Certificate
            </Link>
            {/* Omega Protocol: the uploaded certificate and chromatogram live on
                the Supabase storage domain, so they must render inside
                IframeModal rather than navigating the researcher off
                pepnationlab.com. */}
            {certificateUrl && (
              <IframeLink href={certificateUrl} className="btn-secondary">
                View The Signed Source File
              </IframeLink>
            )}
          </section>

          {/* Chromatogram preview — shown as a scaled thumbnail so it never clips
              on mobile. Tapping the link opens the full SVG inside IframeModal. */}
          {chromatogramUrl && (
            <section style={{ marginBottom: '1.75rem' }}>
              <h3 style={{ fontSize: '0.9rem', color: '#D0DAE4', marginBottom: '0.75rem' }}>
                HPLC Chromatogram
              </h3>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid #1D2D3E',
                marginBottom: '0.5rem',
              }}>
                <img
                  src={chromatogramUrl}
                  alt="HPLC Chromatogram preview"
                  style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 180, objectFit: 'contain' }}
                />
              </div>
              <IframeLink
                href={chromatogramUrl}
                style={{
                  fontSize: '0.85rem',
                  color: '#00C4BC',
                  fontWeight: 600,
                  textDecoration: 'underline',
                }}
              >
                View Full Chromatogram
              </IframeLink>
            </section>
          )}

          <footer
            style={{
              marginTop: '2rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid #1D2D3E',
              color: '#A8B4C0',
              fontSize: '0.85rem',
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: 0 }}>
              Values Are Reproduced As Reported By The Testing Laboratory. Fields Marked Not Reported
              Were Not Measured For This Batch. This Document Describes A Research Chemical Supplied
              For Laboratory Use Only. It Is Not A Drug, And It Is Not For Human Or Veterinary Use.
            </p>
          </footer>
        </article>
      )}

      <p style={{ marginTop: '2.5rem', color: '#A8B4C0', fontSize: '0.9rem' }}>
        <Link href="/compliance" style={{ color: '#A8B4C0' }}>
          Read Our Compliance Policy
        </Link>
      </p>
    </main>
  );
}
