/**
 * GET /api/research/search-index - public, read-only universal search index for
 * the Research Library (compounds, stacks, areas, guides, glossary, FAQ). Lets
 * the client landing page run instant in-place search without a per-keystroke
 * round-trip. Cached at the edge. Research-use-only; no dosing, no user data.
 */

import { NextResponse } from 'next/server';
import { getAllCompounds } from '@/lib/compounds-server';
import { buildResearchSearchDocs } from '@/lib/research-search-docs';

export async function GET() {
  try {
    const compounds = await getAllCompounds();
    const docs = buildResearchSearchDocs(compounds);
    return NextResponse.json(
      { docs },
      { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } },
    );
  } catch {
    return NextResponse.json({ docs: [] }, { status: 200 });
  }
}
