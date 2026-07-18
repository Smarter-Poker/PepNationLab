import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * ONE-SHOT FIX: Clear savage-brands custom_image_url values that were
 * accidentally written to PepNation (researchstore / house store) agent_products.
 *
 * The /api/admin/temp-savage-update route set custom_image_url = /images/savage-brands/...
 * for ALL agents, overwriting the house store's product images. This route clears
 * those rows so getProductImage() falls through to the correct lib/categoryImage.ts
 * mapping (the PepNation /images/products/ vials).
 *
 * Run once via GET /api/admin/fix-pepnation-images then DELETE this file.
 */
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = createAdminClient();

  // 1. Resolve the house store agent id
  const { data: houseStore, error: houseErr } = await supabase
    .from('agent_profiles')
    .select('id')
    .eq('slug', 'researchstore')
    .maybeSingle();

  if (houseErr || !houseStore) {
    return NextResponse.json({ error: 'Could not find researchstore agent profile', details: houseErr }, { status: 404 });
  }

  const houseAgentId = houseStore.id;

  // 2. Find all agent_products for the house store that have a savage-brands custom_image_url
  const { data: affected, error: fetchErr } = await supabase
    .from('agent_products')
    .select('id, custom_image_url')
    .eq('agent_id', houseAgentId)
    .like('custom_image_url', '/images/savage-brands/%');

  if (fetchErr) {
    return NextResponse.json({ error: 'Failed to query agent_products', details: fetchErr }, { status: 500 });
  }

  if (!affected || affected.length === 0) {
    return NextResponse.json({ message: 'No savage-brands images found on house store — already clean!', cleared: 0 });
  }

  // 3. Clear custom_image_url for all affected rows
  const affectedIds = affected.map(r => r.id);
  const { error: updateErr } = await supabase
    .from('agent_products')
    .update({ custom_image_url: null })
    .in('id', affectedIds);

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to clear custom_image_url', details: updateErr }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `Cleared ${affectedIds.length} savage-brands image overrides from the house store (researchstore). PepNation vials will now render correctly.`,
    cleared: affectedIds.length,
    clearedRows: affected.map(r => ({ id: r.id, was: r.custom_image_url })),
  });
}
