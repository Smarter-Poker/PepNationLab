import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { generateQrDataUrl } from '@/lib/qr';
import CertificateDocument, { type CertificateData } from '@/components/coa/CertificateDocument';
import PrintButton from './PrintButton';
import CoaBackButton from '../../CoaBackButton';
import { getLabInfo } from '@/lib/labs';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pepnationlab.com';

// The Certificate Of Analysis is reviewed and signed off by the laboratory
// technician who runs the assays, not by whichever admin clicks verify.
// Signatories are dynamically assigned via getLabInfo based on testing_lab.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = {
  title: 'Certificate Of Analysis | Pep Nation Lab',
  robots: { index: false, follow: false },
};

interface CoaRow {
  lot_id: string;
  lot_number: string;
  product_name: string;
  product_slug: string;
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
  chromatogram_storage_key: string | null;
  coa_verified_at: string;
  reference_mass_da: number | null;
  sequence_one_letter: string | null;
  cas_number: string | null;
}

export default async function CertificatePage({ params }: { params: Promise<{ lot: string }> }) {
  const { lot } = await params;
  const raw = decodeURIComponent(lot).trim().slice(0, 64);
  if (!raw) notFound();

  const supabase = await createServiceClient();

  // A QR code targets the lot's UUID (globally unique, resolves to exactly one
  // certificate). A human typing the lot number off a vial hits the same page by
  // lot string. Both paths land here.
  const { data, error } = UUID_RE.test(raw)
    ? await supabase.rpc('lookup_coa_by_id', { p_id: raw })
    : await supabase.rpc('lookup_coa_by_lot', { p_lot: raw });

  const record = (data as CoaRow[] | null)?.[0] ?? null;

  // Only VERIFIED, non-retracted lots resolve. If nothing comes back there is no
  // certificate to render, by design.
  if (error || !record) notFound();

  // The QR code encodes the canonical, globally-unique URL for THIS lot: its
  // UUID. No two lots share an id, so no two QR codes are alike and each points
  // only at its own certificate.
  const canonicalUrl = `${APP_URL}/coa/${record.lot_id}/certificate`;

  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await generateQrDataUrl(canonicalUrl, '#0F1923', '#FFFFFF');
  } catch {
    qrDataUrl = null;
  }

  let chromatogramUrl: string | null = null;
  if (record.chromatogram_storage_key) {
    chromatogramUrl =
      supabase.storage.from('product-coas').getPublicUrl(record.chromatogram_storage_key).data
        ?.publicUrl ?? null;
  }

  const cert: CertificateData = {
    lotNumber: record.lot_number,
    productName: record.product_name,
    reportNumber: record.lab_report_number,
    testDate: record.test_date,
    appearance: record.appearance,
    storage: null,
    purityPct: record.purity_pct,
    purityMethod: record.purity_method,
    hplcColumn: record.hplc_column,
    hplcWavelengthNm: record.hplc_wavelength_nm,
    msMethod: record.ms_method,
    msObservedMassDa: record.ms_observed_mass_da,
    msTheoreticalMassDa: record.ms_theoretical_mass_da,
    waterContentPct: record.water_content_pct,
    netPeptideContentPct: record.net_peptide_content_pct,
    referenceMassDa: record.reference_mass_da,
    sequenceOneLetter: record.sequence_one_letter,
    cas: record.cas_number,
    testingLab: record.testing_lab,
    labIsThirdParty: record.lab_is_third_party,
    labAccreditation: record.lab_accreditation,
    approvedByName: getLabInfo(record.testing_lab).signatoryName,
    approvedByTitle: getLabInfo(record.testing_lab).signatoryTitle,
    verifiedAt: record.coa_verified_at,
    qrDataUrl,
    chromatogramUrl,
    verified: true,
  };

  return (
    <main style={{ padding: 'calc(2.5rem + env(safe-area-inset-top, 0px)) 1rem 4rem' }}>
      <div
        className="coa-actions"
        style={{ maxWidth: 780, margin: '0 auto 1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}
      >
        {/* Back goes to WHERE YOU CAME FROM (product page, order, storefront),
            not to a fixed verification page - landing somewhere you never
            were is how this page felt like a dead end on mobile. When there
            is no history (QR scan off a vial, shared link, PWA cold start)
            the button becomes a real link to the verification lookup so there
            is always a way out. */}
        <CoaBackButton
          fallbackHref={`/coa?lot=${encodeURIComponent(record.lot_number)}`}
          fallbackLabel="Back To Verification"
        />
        <PrintButton />
      </div>

      <CertificateDocument data={cert} />

      <style>{`@media print {
        .coa-actions { display: none !important; }
        main { padding: 0 !important; }
      }`}</style>
    </main>
  );
}
