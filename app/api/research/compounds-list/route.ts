import { NextResponse } from 'next/server';
import { getAllCompounds } from '@/lib/compounds-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const compounds = await getAllCompounds();
    const list = compounds.map((c) => ({
      ...c,
      molecular_weight_da: c.molecular_weight_da || null,
      sequence: c.identity?.sequence || null,
    }));
    // Public, non-personalized catalog data - safe to cache at the CDN edge.
    return NextResponse.json(
      { compounds: list },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch compounds list' }, { status: 500 });
  }
}
