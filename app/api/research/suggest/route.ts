/**
 * GET /api/research/suggest?q=...
 *
 * Public autocomplete endpoint. Returns up to 8 ranked suggestions that
 * mix three universes:
 *   - compounds (FTS rank over compound_search)
 *   - research areas (from RESEARCH_AREAS in lib/compounds.ts)
 *   - glossary terms (from GLOSSARY in lib/compounds.ts)
 *
 * Designed to be fast (single SQL RPC + two in-memory scans) so the
 * dropdown stays responsive on keystroke. Per-IP rate-limited with a
 * cheap in-process token bucket.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { parseQuery, buildAutoWildcardTsquery } from '@/lib/research/search-parser';
import { RESEARCH_AREAS, GLOSSARY } from '@/lib/compounds';

export const dynamic = 'force-dynamic';

interface Suggestion {
  slug: string;
  display_name: string;
  kind: 'compound' | 'area' | 'glossary';
  evidence_tier?: string;
  wada_status?: string;
  blurb?: string;
}

// Per-IP rate limit: 30 req / 10s. Suggest is hammered on every keystroke
// so this is intentionally generous.
const BUCKETS = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 10_000;
const RATE_MAX = 30;

function ipOf(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const b = BUCKETS.get(ip);
  if (!b || b.resetAt < now) {
    BUCKETS.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  b.count += 1;
  return b.count > RATE_MAX;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function scoreArea(qNorm: string, key: string, label: string): number {
  const k = normalize(key);
  const l = normalize(label);
  if (k === qNorm || l === qNorm) return 10;
  if (k.startsWith(qNorm) || l.startsWith(qNorm)) return 6;
  if (k.includes(qNorm) || l.includes(qNorm)) return 3;
  return 0;
}

function scoreGlossary(qNorm: string, term: string, blurb: string): number {
  const t = normalize(term);
  const b = normalize(blurb);
  if (t === qNorm) return 9;
  if (t.startsWith(qNorm)) return 5;
  if (t.includes(qNorm)) return 3;
  if (b.includes(qNorm)) return 1;
  return 0;
}

export async function GET(req: NextRequest) {
  const t0 = Date.now();
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();

  if (!q) {
    return NextResponse.json({ suggestions: [], latencyMs: 0 });
  }

  const ip = ipOf(req);
  if (rateLimited(ip)) {
    return NextResponse.json({ suggestions: [], latencyMs: 0 }, { status: 429 });
  }

  const parsed = parseQuery(q);
  const tsquery = buildAutoWildcardTsquery(parsed);
  const qNorm = parsed.normalized;

  const supabase = await createServiceClient();

  // 1. Compound suggestions — call the same FTS RPC the search route uses,
  //    asking for the top 6 hits only.
  const compoundSuggestions: Suggestion[] = [];
  if (tsquery) {
    const { data } = await supabase.rpc('search_compounds_rank', {
      p_tsquery: tsquery,
      p_limit: 6,
      p_offset: 0,
    });
    if (Array.isArray(data)) {
      for (const row of data as Array<Record<string, unknown>>) {
        compoundSuggestions.push({
          slug: String(row.slug ?? ''),
          display_name: String(row.display_name ?? ''),
          kind: 'compound',
          evidence_tier: String(row.evidence_tier ?? ''),
          wada_status: String(row.wada_status ?? 'not_listed'),
          blurb: typeof row.snippet === 'string' ? (row.snippet as string).slice(0, 140) : '',
        });
      }
    }
  }

  // 2. Research-area suggestions — pure in-memory scan.
  const areaCandidates: Array<{ s: Suggestion; score: number }> = [];
  for (const [key, meta] of Object.entries(RESEARCH_AREAS)) {
    const score = scoreArea(qNorm, key, meta.label);
    if (score > 0) {
      areaCandidates.push({
        s: {
          slug: key,
          display_name: meta.label,
          kind: 'area',
          blurb: meta.blurb,
        },
        score,
      });
    }
  }
  areaCandidates.sort((a, b) => b.score - a.score);
  const areaSuggestions = areaCandidates.slice(0, 4).map((x) => x.s);

  // 3. Glossary term suggestions.
  const glossaryCandidates: Array<{ s: Suggestion; score: number }> = [];
  for (const [term, blurb] of Object.entries(GLOSSARY)) {
    const score = scoreGlossary(qNorm, term, blurb);
    if (score > 0) {
      const label = term
        .split(/\s+/)
        .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
        .join(' ');
      glossaryCandidates.push({
        s: { slug: term, display_name: label, kind: 'glossary', blurb },
        score,
      });
    }
  }
  glossaryCandidates.sort((a, b) => b.score - a.score);
  const glossarySuggestions = glossaryCandidates.slice(0, 3).map((x) => x.s);

  // 4. Mix: compounds first (most authoritative), then areas, then glossary.
  const suggestions: Suggestion[] = [
    ...compoundSuggestions,
    ...areaSuggestions,
    ...glossarySuggestions,
  ].slice(0, 8);

  return NextResponse.json({
    suggestions,
    latencyMs: Date.now() - t0,
  });
}
