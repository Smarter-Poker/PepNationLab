import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { analyzeCartWarnings, type Compound } from '@/lib/compounds';

export const dynamic = 'force-dynamic';

function coerceCompound(row: Record<string, unknown>): Compound {
  return {
    ...(row as unknown as Compound),
    identity: (row.identity as Compound['identity']) ?? {},
    handling: (row.handling as Compound['handling']) ?? {},
    aliases: (row.aliases as string[]) ?? [],
    studied_for: (row.studied_for as string[]) ?? [],
    research_areas: (row.research_areas as string[]) ?? [],
    sources: (row.sources as string[]) ?? [],
    stack_components: (row.stack_components as string[]) ?? [],
    risk_reasons: (row.risk_reasons as string[]) ?? [],
  };
}

export async function POST(req: NextRequest) {
  let slugs: string[] = [];
  try {
    const body = await req.json();
    if (Array.isArray(body?.slugs)) {
      slugs = body.slugs.filter((s: unknown): s is string => typeof s === 'string');
    }
  } catch {
    slugs = [];
  }

  if (slugs.length === 0) {
    return NextResponse.json({ warnings: [] });
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase.from('compounds').select('*').in('slug', slugs);

  if (error || !data) {
    return NextResponse.json({ warnings: [] });
  }

  const compounds = data.map((row) => coerceCompound(row as Record<string, unknown>));
  const warnings = analyzeCartWarnings(compounds);
  return NextResponse.json({ warnings });
}
