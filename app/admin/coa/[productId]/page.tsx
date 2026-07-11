import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import AdminCoaEditor, { type EditorLot } from '@/components/admin/AdminCoaEditor';

export const dynamic = 'force-dynamic';

// Admin-gated by app/admin/layout.tsx.

interface Params {
  params: Promise<{ productId: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminCoaEditorPage({ params }: Params) {
  const { productId } = await params;
  if (!UUID_RE.test(productId)) notFound();

  const supabase = await createServiceClient();

  const { data: product } = await supabase
    .from('products')
    .select('id, name')
    .eq('id', productId)
    .maybeSingle();

  if (!product) notFound();

  const { data: lots } = await supabase
    .from('product_lots')
    .select(
      'id, lot_number, test_date, purity_pct, purity_method, hplc_column, hplc_wavelength_nm, ms_method, ms_observed_mass_da, ms_theoretical_mass_da, water_content_pct, net_peptide_content_pct, appearance, testing_lab, lab_report_number, lab_is_third_party, lab_accreditation, coa_storage_key, coa_verified_at, coa_retracted_at',
    )
    .eq('product_id', productId)
    .is('superseded_by', null)
    .order('created_at', { ascending: false });

  return (
    <main style={{ padding: '2rem 1.25rem 5rem', maxWidth: 820, margin: '0 auto' }}>
      <Link href="/admin/coa" style={{ color: '#A8B4C0', fontSize: '0.9rem' }}>
        Back To Preview
      </Link>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.75rem 0 0.25rem' }}>
        {product.name}
      </h1>
      <p style={{ color: '#A8B4C0', lineHeight: 1.7, marginBottom: '1.5rem' }}>
        Enter The Laboratory Results Exactly As The Testing Lab Reported Them. Leave A Field Blank If
        It Was Not Measured. Verify Only After Confirming The Values Against The Signed Certificate.
      </p>

      <AdminCoaEditor productId={product.id} initialLots={(lots as EditorLot[] | null) ?? []} />
    </main>
  );
}
