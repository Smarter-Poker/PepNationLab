import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import CertificateDocument, { type CertificateData } from '@/components/coa/CertificateDocument';
import { generateCoaSample } from '@/lib/coa/sample';

export const dynamic = 'force-dynamic';

// Admin-gated by app/admin/layout.tsx (redirects non-admins). This page renders
// a SAMPLE certificate for every peptide so the finished layout can be reviewed
// across the whole catalogue before any real testing exists. Every value shown
// is a generated placeholder behind a permanent SAMPLE watermark; nothing here
// is written to the database, verified, or exposed publicly.

const LAB_SIGNATORY = 'Swadep Mirsha';
const LAB_SIGNATORY_TITLE = 'Laboratory Technician';

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  molecular_weight_da: number | null;
  sequence_one_letter: string | null;
}

export default async function AdminCoaPreviewPage() {
  const supabase = await createServiceClient();

  const { data, error } = await supabase.rpc('coa_preview_catalogue');

  const rows = (data as ProductRow[] | null) ?? [];

  const certificates: Array<{ productId: string; cert: CertificateData }> = rows.map((r) => {
    const sample = generateCoaSample(r.name, r.molecular_weight_da);
    return {
      productId: r.id,
      cert: {
        lotNumber: sample.lotNumber,
        productName: r.name,
        reportNumber: sample.reportNumber,
        testDate: sample.testDate,
        appearance: sample.appearance,
        storage: null,
        purityPct: sample.purityPct,
        purityMethod: sample.purityMethod,
        hplcColumn: sample.hplcColumn,
        hplcWavelengthNm: sample.hplcWavelengthNm,
        msMethod: sample.msMethod,
        msObservedMassDa: sample.msObservedMassDa,
        msTheoreticalMassDa: sample.msTheoreticalMassDa,
        referenceMassDa: r.molecular_weight_da,
        sequenceOneLetter: r.sequence_one_letter,
        waterContentPct: sample.waterContentPct,
        netPeptideContentPct: sample.netPeptideContentPct,
        testingLab: sample.testingLab,
        labIsThirdParty: sample.labIsThirdParty,
        labAccreditation: sample.labAccreditation,
        approvedByName: LAB_SIGNATORY,
        approvedByTitle: LAB_SIGNATORY_TITLE,
        verifiedAt: null,
        qrDataUrl: null,
        chromatogramUrl: null,
        verified: false,
        sample: true,
      },
    };
  });

  return (
    <main style={{ padding: '2rem 1.25rem 5rem', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>
        Certificate Of Analysis Preview
      </h1>
      <p style={{ color: '#A8B4C0', lineHeight: 1.7, marginBottom: '0.5rem' }}>
        A Sample Certificate For Every Peptide In The Catalogue, Populated With Generated Placeholder
        Values So The Finished Layout Can Be Reviewed. Theoretical Mass And Sequence Are Real
        Chemical Constants. The Measured Values Are Sample Data For Design Review Only And Are Not The
        Result Of Testing Any Batch.
      </p>

      {error && (
        <div className="card" style={{ padding: '1.5rem', borderColor: '#E53E3E', marginTop: '1rem' }}>
          <p style={{ color: '#E53E3E', margin: 0 }}>The Catalogue Could Not Be Loaded.</p>
        </div>
      )}

      <p style={{ color: '#00C4BC', fontSize: '0.9rem', margin: '1rem 0 2rem' }}>
        {certificates.length} Peptides. To Publish A Real Certificate, Open A Peptide And Enter The
        Laboratory Results, Then Verify.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
        {certificates.map(({ productId, cert }) => (
          <section key={productId}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{cert.productName}</h2>
              <Link href={`/admin/coa/${productId}`} className="btn-secondary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
                Enter Real Results
              </Link>
            </div>
            <CertificateDocument data={cert} />
          </section>
        ))}
      </div>
    </main>
  );
}
