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
    return NextResponse.json({ compounds: list });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch compounds list' }, { status: 500 });
  }
}
