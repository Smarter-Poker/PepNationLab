import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { wadaLabel } from '@/lib/compounds';

export const dynamic = 'force-dynamic';

const RESEARCH_NOTE =
  'For Research Use Only. This Restates Stored Laboratory Facts And Is Not Dosing Or Medical Advice.';

interface CompoundRow {
  slug: string;
  display_name: string;
  aliases: string[] | null;
  evidence_tier: string;
  mechanism: string | null;
  studied_for: string[] | null;
  benefits: string | null;
  side_effects: string | null;
  warnings: string | null;
  handling: { storage_temp?: string } | null;
  wada_status: string;
  regulatory: string | null;
}

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function scoreCompound(qTokens: Set<string>, row: CompoundRow): number {
  const haystack = [
    row.display_name,
    ...(row.aliases ?? []),
    row.mechanism ?? '',
    ...(row.studied_for ?? []),
  ].join(' ');
  const hayTokens = tokenize(haystack);
  let score = 0;
  for (const t of hayTokens) {
    if (qTokens.has(t)) score += 1;
  }
  // Direct name / alias mention is a strong signal.
  const nameTokens = tokenize([row.display_name, ...(row.aliases ?? [])].join(' '));
  for (const t of nameTokens) {
    if (qTokens.has(t)) score += 2;
  }
  return score;
}

function composeAnswer(row: CompoundRow): string {
  const parts: string[] = [];
  if (row.mechanism) parts.push(`Mechanism: ${row.mechanism}`);
  if (row.studied_for && row.studied_for.length > 0) {
    parts.push(`Studied For: ${row.studied_for.join(', ')}`);
  }
  if (row.handling?.storage_temp) parts.push(`Storage: ${row.handling.storage_temp}`);
  parts.push(`Status: ${wadaLabel(row.wada_status)}`);
  return parts.join('. ') + '.';
}

function buildMatch(row: CompoundRow) {
  return {
    slug: row.slug,
    name: row.display_name,
    evidence_tier: row.evidence_tier,
    answer: {
      slug: row.slug,
      name: row.display_name,
      evidence_tier: row.evidence_tier,
      mechanism: row.mechanism,
      studied_for: row.studied_for ?? [],
      storage: row.handling?.storage_temp ?? null,
      wada: wadaLabel(row.wada_status),
    },
    composed: composeAnswer(row),
  };
}

async function handle(q: string) {
  const query = (q || '').trim();
  if (!query) {
    return NextResponse.json({
      matches: [],
      message: 'No Matching Compound Found. Try A Compound Name.',
      note: RESEARCH_NOTE,
    });
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('compounds')
    .select(
      'slug, display_name, aliases, evidence_tier, mechanism, studied_for, benefits, side_effects, warnings, handling, wada_status, regulatory'
    );

  if (error || !data) {
    return NextResponse.json(
      { matches: [], message: 'No Matching Compound Found. Try A Compound Name.', note: RESEARCH_NOTE },
      { status: 200 }
    );
  }

  const qTokens = new Set(tokenize(query));
  const scored = (data as CompoundRow[])
    .map((row) => ({ row, score: scoreCompound(qTokens, row) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scored.length === 0) {
    return NextResponse.json({
      matches: [],
      message: 'No Matching Compound Found. Try A Compound Name.',
      note: RESEARCH_NOTE,
    });
  }

  return NextResponse.json({
    matches: scored.map((s) => buildMatch(s.row)),
    note: RESEARCH_NOTE,
  });
}

export async function POST(req: NextRequest) {
  let q = '';
  try {
    const body = await req.json();
    q = typeof body?.q === 'string' ? body.q : '';
  } catch {
    q = '';
  }
  return handle(q);
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  return handle(q);
}
