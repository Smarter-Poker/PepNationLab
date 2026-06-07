import { NextRequest, NextResponse } from 'next/server';
import { getAreaProducts } from '@/lib/area-products-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slugsParam = searchParams.get('slugs');
  
  if (!slugsParam) {
    return NextResponse.json({ products: [] });
  }
  
  const slugs = slugsParam.split(',').map(s => s.trim()).filter(Boolean);
  if (slugs.length === 0) {
    return NextResponse.json({ products: [] });
  }

  try {
    const { products } = await getAreaProducts(slugs);
    return NextResponse.json({ products });
  } catch (err) {
    console.error('Failed to fetch live products', err);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
