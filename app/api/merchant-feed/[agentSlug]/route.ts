import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { SITE_BASE } from '@/lib/structured-data/merchant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentSlug: string }> }
) {
  const { agentSlug } = await params;
  const slug = agentSlug.trim().toLowerCase();

  const supabase = await createServiceClient();

  const { data: agent } = await supabase
    .from('agent_profiles')
    .select('id, slug, display_name, is_active')
    .eq('slug', slug)
    .maybeSingle();

  if (!agent || !agent.is_active) {
    return new Response('Not Found or Inactive Storefront', { status: 404 });
  }

  const { data: products } = await supabase
    .from('agent_products')
    .select(`
      id,
      product_id,
      custom_name,
      custom_description,
      custom_image_url,
      retail_price,
      is_on_sale,
      sale_price,
      products (
        name,
        description,
        image_url
      )
    `)
    .eq('agent_id', agent.id)
    .eq('is_visible', true)
    .order('sort_order', { nullsFirst: false })
    .limit(500);

  const { data: inventory } = await supabase
    .rpc('agent_inventory_for_storefront', { p_slug: slug });

  const inventoryMap = new Map<string, number>();
  for (const row of (inventory ?? []) as Array<{ product_id: string; stock_count: number }>) {
    inventoryMap.set(row.product_id, row.stock_count);
  }

  const items = (products ?? []).map((p: any) => {
    const name = String(p.custom_name || p.products?.name || '').trim();
    if (!name) return null;
    
    const desc = String(p.custom_description || p.products?.description || '').trim();
    const finalDesc = (desc ? desc + ' ' : '') + 'For In Vitro Laboratory Research Use Only. Not For Human Or Animal Consumption.';
    
    const rawImage = p.custom_image_url || p.products?.image_url;
    const imageUrl = rawImage?.startsWith('http') ? rawImage : `${SITE_BASE}${rawImage || ''}`;
    
    const price = Number(p.is_on_sale ? p.sale_price : p.retail_price);
    if (!Number.isFinite(price) || price <= 0) return null;

    const inStock = (inventoryMap.get(p.product_id) ?? 0) > 0;
    
    const url = `${SITE_BASE}/${slug}?product=${encodeURIComponent(p.product_id)}`;

    return `    <item>
      <g:id>${esc(p.product_id)}</g:id>
      <g:title>${esc(name)}</g:title>
      <g:description>${esc(finalDesc)}</g:description>
      <g:link>${esc(url)}</g:link>
      <g:image_link>${esc(imageUrl)}</g:image_link>
      <g:condition>new</g:condition>
      <g:availability>${inStock ? 'in_stock' : 'out_of_stock'}</g:availability>
      <g:price>${price.toFixed(2)} USD</g:price>
      <g:brand>Pep Nation Lab</g:brand>
      <g:google_product_category>3320</g:google_product_category>
      <g:identifier_exists>no</g:identifier_exists>
    </item>`;
  }).filter(Boolean);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>${esc(agent.display_name)} - Pep Nation Lab</title>
    <link>${SITE_BASE}/${esc(slug)}</link>
    <description>Research Peptides and Compounds</description>
${items.join('\n')}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
    },
  });
}
