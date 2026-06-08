import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const RESEARCH_NOTE =
  'For Research Use Only. This Restates Stored Laboratory Facts And Is Not Dosing Or Medical Advice.';

interface CompoundRow {
  slug: string;
  display_name: string;
  aliases: string[] | null;
  category: string | null;
  evidence_tier: string;
  compound_class: string | null;
  molecular_target: string | null;
  mechanism: string | null;
  studied_for: string[] | null;
  research_areas: string[] | null;
  benefits: string | null;
  side_effects: string | null;
  warnings: string | null;
  plain_summary: string | null;
  handling: { storage_temp?: string } | null;
  regulatory: string | null;
  search_keywords: string[] | null;
  match_phrases: string[] | null;
}

// Lay-term intent expansion: map common phrasings to the words our data uses,
// so "lose weight" finds "weight loss / fat", "can't sleep" finds "sleep", etc.
const INTENT_EXPANSIONS: Record<string, string[]> = {
  'lose weight': ['weight', 'loss', 'fat', 'obesity', 'appetite'],
  'weight loss': ['weight', 'loss', 'fat', 'obesity', 'appetite'],
  'fat loss': ['fat', 'loss', 'weight', 'lipolysis', 'metabolic'],
  'belly fat': ['fat', 'visceral', 'weight', 'metabolic'],
  'build muscle': ['muscle', 'growth', 'hypertrophy', 'lean', 'performance'],
  'muscle gain': ['muscle', 'growth', 'hypertrophy', 'lean'],
  'joint pain': ['joint', 'tendon', 'ligament', 'repair', 'healing', 'injury'],
  'injury': ['injury', 'repair', 'healing', 'recovery', 'tendon'],
  'gut health': ['gut', 'healing', 'inflammation', 'colitis'],
  'sleep': ['sleep', 'insomnia', 'circadian'],
  "can't sleep": ['sleep', 'insomnia', 'circadian'],
  'anti aging': ['aging', 'longevity', 'telomere', 'senescent'],
  'anti-aging': ['aging', 'longevity', 'telomere', 'senescent'],
  'hair loss': ['hair', 'follicle', 'regrowth'],
  'hair growth': ['hair', 'follicle', 'regrowth'],
  'tan': ['tanning', 'pigmentation', 'melanin'],
  'tanning': ['tanning', 'pigmentation', 'melanin'],
  'libido': ['libido', 'sexual', 'arousal', 'desire'],
  'sex drive': ['libido', 'sexual', 'arousal', 'desire'],
  'energy': ['energy', 'mitochondrial', 'fatigue', 'nad'],
  'focus': ['cognition', 'cognitive', 'memory', 'focus', 'nootropic'],
  'memory': ['cognition', 'cognitive', 'memory', 'nootropic'],
  'anxiety': ['anxiety', 'stress', 'calm', 'mood'],
  'immune': ['immune', 'immunity', 'infection'],
  'skin': ['skin', 'collagen', 'cosmetic', 'wrinkle'],
  'wrinkles': ['wrinkle', 'skin', 'collagen', 'expression'],
  'fertility': ['fertility', 'reproductive', 'ovulation', 'sperm'],
  'inflammation': ['inflammation', 'anti inflammatory', 'immune'],
};

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s+-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function expandQuery(query: string): { tokens: Set<string>; phrase: string } {
  const phrase = query.toLowerCase().trim();
  const tokens = new Set(tokenize(query));
  for (const [key, extra] of Object.entries(INTENT_EXPANSIONS)) {
    if (phrase.includes(key)) extra.forEach((e) => tokens.add(e));
  }
  return { tokens, phrase };
}

interface Scored {
  row: CompoundRow;
  score: number;
  reason: string;
}

function scoreCompound(qTokens: Set<string>, qPhrase: string, row: CompoundRow): Scored {
  let score = 0;
  let reason = '';

  const name = (row.display_name || '').toLowerCase();
  const aliases = (row.aliases ?? []).map((a) => a.toLowerCase());
  const keywords = (row.search_keywords ?? []).map((k) => k.toLowerCase());

  // 1. Exact / direct name or alias hit - strongest signal.
  if (name === qPhrase || aliases.includes(qPhrase)) {
    score += 12;
    reason = 'Direct Name Match';
  } else if (qPhrase.length >= 3 && (name.includes(qPhrase) || aliases.some((a) => a.includes(qPhrase)))) {
    score += 8;
    reason = 'Name Match';
  }

  // 2. Whole-query phrase appears in a keyword (powers goal searches like "fat loss").
  if (qPhrase.length >= 3) {
    const kwHit = keywords.find((k) => k === qPhrase || k.includes(qPhrase));
    if (kwHit) {
      score += 7;
      if (!reason) reason = `Matched "${kwHit}"`;
    }
  }

  // 3. Token overlap against keyword phrases (synonyms + goal terms).
  let kwTokenHits = 0;
  let firstKwHit = '';
  for (const k of keywords) {
    const kTokens = tokenize(k);
    if (kTokens.some((t) => qTokens.has(t))) {
      kwTokenHits += 1;
      if (!firstKwHit) firstKwHit = k;
    }
  }
  if (kwTokenHits > 0) {
    score += Math.min(kwTokenHits, 4) * 2;
    if (!reason) reason = `Studied For "${firstKwHit}"`;
  }

  // 4. Name/alias token overlap.
  const nameTokens = tokenize([row.display_name, ...(row.aliases ?? [])].join(' '));
  for (const t of nameTokens) if (qTokens.has(t)) score += 2;

  // 5. Prose / structured fields - lighter weight.
  const proseTokens = tokenize(
    [
      row.mechanism ?? '',
      row.benefits ?? '',
      row.plain_summary ?? '',
      row.category ?? '',
      row.compound_class ?? '',
      row.molecular_target ?? '',
      ...(row.studied_for ?? []),
      ...(row.research_areas ?? []),
    ].join(' '),
  );
  const proseSet = new Set(proseTokens);
  let proseHits = 0;
  for (const t of qTokens) if (proseSet.has(t)) proseHits += 1;
  score += Math.min(proseHits, 5);
  if (!reason && proseHits > 0) reason = 'Mentioned In Research Notes';

  return { row, score, reason: reason || 'Related Compound' };
}

function buildMatch(s: Scored) {
  const row = s.row;
  const phrase = (row.match_phrases ?? [])[0] ?? null;
  const composedParts: string[] = [];
  if (phrase) composedParts.push(phrase);
  else if (row.mechanism) composedParts.push(row.mechanism);
  if (row.studied_for && row.studied_for.length > 0) {
    composedParts.push(`Studied For: ${row.studied_for.slice(0, 4).join(', ')}`);
  }
  return {
    slug: row.slug,
    name: row.display_name,
    evidence_tier: row.evidence_tier,
    category: row.category,
    reason: s.reason,
    phrase,
    composed: composedParts.join('. ') + '.',
  };
}

async function handle(q: string) {
  const query = (q || '').trim();
  if (!query) {
    return NextResponse.json({
      matches: [],
      message: 'Search By Goal, Symptom, Or Compound Name - Try "Fat Loss", "Joint Pain", Or "BPC-157".',
      note: RESEARCH_NOTE,
    });
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('compounds')
    .select(
      'slug, display_name, aliases, category, evidence_tier, compound_class, molecular_target, mechanism, studied_for, research_areas, benefits, side_effects, warnings, plain_summary, handling, regulatory, search_keywords, match_phrases',
    );

  if (error || !data) {
    return NextResponse.json(
      { matches: [], message: 'Search Is Temporarily Unavailable. Please Try Again.', note: RESEARCH_NOTE },
      { status: 200 },
    );
  }

  const { tokens: qTokens, phrase: qPhrase } = expandQuery(query);
  const scored = (data as CompoundRow[])
    .map((row) => scoreCompound(qTokens, qPhrase, row))
    .filter((s) => s.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (scored.length === 0) {
    return NextResponse.json({
      matches: [],
      message: 'No Matching Compound Found. Try A Goal Like "Recovery", "Sleep", Or "Weight Loss".',
      note: RESEARCH_NOTE,
    });
  }

  return NextResponse.json({ matches: scored.map(buildMatch), note: RESEARCH_NOTE });
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
