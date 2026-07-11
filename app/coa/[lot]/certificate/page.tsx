import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { generateQrDataUrl } from '@/lib/qr';
import CertificateDocument, { type CertificateData } from '@/components/coa/CertificateDocument';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pepnationlab.com';

export const metadata: Metadata = {
  title: 'Certificate Of Analysis | Pep Nation Lab',
  robots: { index: false, follow: false },
};

interface CoaRow {
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
  approved_by_name: string | null;
}

export default async function CertificatePage({ params }: { params: Promise<{ lot: string }> }) {
  const { lot } = await params;
  const query = decodeURIComponent(lot).trim().slice(0, 64);
  if (!query) notFound();

  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc('lookup_coa_by_lot', { p_lot: query });
  const record = (data as CoaRow[] | null)?.[0] ?? null;

  // Only VERIFIED, non-retracted lots resolve through lookup_coa_by_lot. If
  // nothing comes back there is no certificate to render, by design.
  if (error || !record) notFound();

  const verifyUrl = `${APP_URL}/coa?lot=${encodeURIComponent(record.lot_number)}`;

  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await generateQrDataUrl(verifyUrl, '#0F1923', '#FFFFFF');
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
    testingLab: record.testing_lab,
    labIsThirdParty: record.lab_is_third_party,
    labAccreditation: record.lab_accreditation,
    approvedByName: record.approved_by_name,
    approvedByTitle: 'Quality Approver',
    verifiedAt: record.coa_verified_at,
    qrDataUrl,
    chromatogramUrl,
    verified: true,
  };

  return (
    <main style={{ padding: '2rem 1rem 4rem' }}>
      <div
        className="coa-actions"
        style={{ maxWidth: 780, margin: '0 auto 1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Link href={`/coa?lot=${encodeURIComponent(record.lot_number)}`} style={{ color: '#A8B4C0', fontSize: '0.9rem' }}>
          Back To Verification
        </Link>
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
