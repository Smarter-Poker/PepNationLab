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
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pepnationlab.com';

const LOT_COLUMNS =
  'id, lot_number, test_date, purity_pct, purity_method, hplc_column, hplc_wavelength_nm, ms_method, ms_observed_mass_da, ms_theoretical_mass_da, water_content_pct, net_peptide_content_pct, appearance, storage, testing_lab, lab_report_number, lab_is_third_party, lab_accreditation, coa_storage_key, coa_verified_at, coa_retracted_at';

function draftLotNumber(slug: string): string {
  const token = (slug || 'lot').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'LOT';
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${token}-DRAFT-${rand}`;
}

export default async function AdminCoaEditorPage({ params }: Params) {
  const { productId } = await params;
  if (!UUID_RE.test(productId)) notFound();

  const supabase = await createServiceClient();

  const { data: product } = await supabase
    .from('products')
    .select('id, name, slug')
    .eq('id', productId)
    .maybeSingle();

  if (!product) notFound();

  // Real per-peptide chemistry for the preview.
  const { data: compound } = await supabase
    .from('compounds')
    .select('molecular_weight_da, sequence_one_letter')
    .ilike('display_name', product.name)
    .not('molecular_weight_da', 'is', null)
    .limit(1)
    .maybeSingle();

  let { data: lots } = await supabase
    .from('product_lots')
    .select(LOT_COLUMNS)
    .eq('product_id', productId)
    .is('superseded_by', null)
    .order('created_at', { ascending: false });

  // Ensure there is always a draft to edit, so every peptide has a ready
  // template. The draft carries an editable provisional lot number and an
  // in-house testing lab, but NO results -- every measured field is blank until
  // an admin enters the real reading.
  if (!lots || lots.length === 0) {
    const { data: created } = await supabase
      .from('product_lots')
      .insert({
        product_id: productId,
        lot_number: draftLotNumber(product.slug),
        testing_lab: 'Pep Nation Lab In-House',
        lab_is_third_party: false,
      })
      .select(LOT_COLUMNS)
      .maybeSingle();
    if (created) lots = [created];
  }

  return (
    <main style={{ padding: '2rem 1.25rem 5rem', maxWidth: 860, margin: '0 auto' }}>
      <Link href="/admin/coa" style={{ color: '#A8B4C0', fontSize: '0.9rem' }}>
        Back To All Certificates
      </Link>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.75rem 0 0.25rem' }}>
        {product.name}
      </h1>
      <p style={{ color: '#A8B4C0', lineHeight: 1.7, marginBottom: '1.5rem' }}>
        Edit The Certificate Below. The Preview Updates As You Type And Shows Exactly How The
        Published Certificate Will Look. Enter The Laboratory Results, Then Publish To Make It Public
        With A Live QR Code. Blank Fields Render As Not Reported.
      </p>

      <AdminCoaEditor
        productId={product.id}
        productName={product.name}
        referenceMassDa={(compound?.molecular_weight_da as number | null) ?? null}
        sequenceOneLetter={(compound?.sequence_one_letter as string | null) ?? null}
        appUrl={APP_URL}
        initialLots={(lots as EditorLot[] | null) ?? []}
      />
    </main>
  );
}
