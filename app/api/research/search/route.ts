/**
 * GET|POST /api/research/search
 *
 * Public, no-auth research search. Parses a Google-style query via
 * lib/research/search-parser.ts, ranks compounds against the
 * compound_search materialized view using ts_rank_cd, and returns
 * highlighted snippets via ts_headline. Falls back to trigram
 * similarity for a typo on a single short token.
 *
 * Best-effort analytics: writes one row to search_queries per request.
 * Response always carries a RESEARCH_NOTE - nothing here is dosing or
 * medical advice.
 */

import { NextResponse, type NextRequest, after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { parseQuery, buildAutoWildcardTsquery, type ParsedQuery } from '@/lib/research/search-parser';
import { classifyIntent, type IntentMatch } from '@/lib/research/intent';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

const RESEARCH_NOTE =
  'For Research Use Only. This Restates Stored Laboratory Facts And Is Not Dosing Or Medical Advice.';

interface SearchResultRow {
  slug: string;
  display_name: string;
  evidence_tier: string;
  wada_status: string;
  snippet: string;
  score: number;
  knowledge_panel_url: string;
}

function firstClientIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}

async function runRankedSearch(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  parsed: ParsedQuery,
  limit: number,
  offset: number,
): Promise<{ rows: SearchResultRow[]; total: number }> {
  const tsquery = buildAutoWildcardTsquery(parsed);
  if (!tsquery) return { rows: [], total: 0 };

  // We have to drop to a server function call to use ts_rank_cd, ts_headline,
  // and the tsvector column at once. Supabase JS doesn't yet expose tsquery
  // operators directly. We hit a SECURITY DEFINER RPC if one exists; otherwise
  // we run a raw SELECT through the PostgREST .rpc('search_compounds_rank').
  // Foundation migration shipped this function - see
  // 20260603100000_research_v3_foundation.sql.
  const { data, error } = await supabase.rpc('search_compounds_rank', {
    p_tsquery: tsquery,
    p_limit: limit,
    p_offset: offset,
  });

  if (error || !data) {
    return { rows: [], total: 0 };
  }

  const rows: SearchResultRow[] = (data as Array<Record<string, unknown>>).map((r) => ({
    slug: String(r.slug ?? ''),
    display_name: String(r.display_name ?? ''),
    evidence_tier: String(r.evidence_tier ?? ''),
    wada_status: String(r.wada_status ?? 'not_listed'),
    snippet: typeof r.snippet === 'string' ? r.snippet : '',
    score: typeof r.score === 'number' ? r.score : Number(r.score ?? 0),
    knowledge_panel_url: `/research/compounds/${String(r.slug ?? '')}`,
  }));

  // total_count column is returned by the RPC on every row.
  const total =
    (data as Array<Record<string, unknown>>)[0]?.total_count !== undefined
      ? Number((data as Array<Record<string, unknown>>)[0].total_count)
      : rows.length;

  return { rows, total: Number.isFinite(total) ? total : rows.length };
}

async function runFallbackTrigram(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  parsed: ParsedQuery,
  limit: number,
): Promise<SearchResultRow[]> {
  // Trigram fallback only when there's a single short token and no phrases.
  const lone = [...parsed.required, ...parsed.terms][0];
  if (
    !lone ||
    lone.length < 3 ||
    parsed.phrases.length > 0 ||
    parsed.terms.length + parsed.required.length !== 1
  ) {
    return [];
  }

  const { data, error } = await supabase.rpc('search_compounds_trgm', {
    p_term: lone,
    p_limit: limit,
  });

  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((r) => ({
    slug: String(r.slug ?? ''),
    display_name: String(r.display_name ?? ''),
    evidence_tier: String(r.evidence_tier ?? ''),
    wada_status: String(r.wada_status ?? 'not_listed'),
    snippet: typeof r.snippet === 'string' ? r.snippet : '',
    score: typeof r.score === 'number' ? r.score : Number(r.score ?? 0),
    knowledge_panel_url: `/research/compounds/${String(r.slug ?? '')}`,
  }));
}

async function logSearchQuery(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  parsed: ParsedQuery,
  intent: IntentMatch,
  total: number,
  topSlug: string | null,
  latencyMs: number,
) {
  try {
    await supabase.from('search_queries').insert({
      query_text: parsed.raw.slice(0, 256),
      query_normalized: parsed.normalized.slice(0, 256),
      result_count: total,
      intent: intent.kind,
      top_result_slug: topSlug,
      clicked_slug: null,
      clicked_position: null,
      latency_ms: latencyMs,
    });
  } catch {
    // analytics is best-effort
  }
}

function levenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1, // deletion
        tmp[i][j - 1] + 1, // insertion
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
      );
    }
  }
  return tmp[a.length][b.length];
}

function findFuzzyCorrection(
  query: string,
  catalog: Array<{ slug: string; display_name: string; aliases: string[] | null }>
): { display_name: string; slug: string } | null {
  const q = query.toLowerCase().trim();
  if (!q || q.length < 3) return null;

  let bestMatch: typeof catalog[0] | null = null;
  let bestDistance = Infinity;

  for (const item of catalog) {
    const names = [
      item.display_name.toLowerCase(),
      item.slug.toLowerCase(),
      ...(item.aliases || []).map((a) => a.toLowerCase()),
    ];

    for (const name of names) {
      if (!name) continue;
      const dist = levenshteinDistance(q, name);
      const maxAllowedDist = Math.max(1, Math.min(3, Math.floor(name.length * 0.35)));
      if (dist <= maxAllowedDist && dist < bestDistance) {
        bestDistance = dist;
        bestMatch = item;
      }
    }
  }

  if (bestMatch && bestDistance > 0) {
    return {
      display_name: bestMatch.display_name,
      slug: bestMatch.slug,
    };
  }
  return null;
}

async function performSearch(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  queryStr: string,
  limit: number,
  offset: number,
) {
  const parsed = parseQuery(queryStr);
  let { rows, total } = await runRankedSearch(supabase, parsed, limit, offset);

  if (rows.length === 0) {
    const trgm = await runFallbackTrigram(supabase, parsed, limit);
    if (trgm.length > 0) {
      rows = trgm;
      total = trgm.length;
    }
  }

  let vectorRows: SearchResultRow[] = [];
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: [queryStr],
      });
      const queryEmbedding = response.embeddings?.[0]?.values;
      if (queryEmbedding) {
        const { data: vectorMatches, error: vecErr } = await supabase.rpc('match_compounds_vector', {
          query_embedding: queryEmbedding,
          match_threshold: 0.3,
          match_limit: limit,
        });
        if (!vecErr && vectorMatches && vectorMatches.length > 0) {
          vectorRows = (vectorMatches as Array<Record<string, unknown>>).map((r) => ({
            slug: String(r.slug ?? ''),
            display_name: String(r.display_name ?? ''),
            evidence_tier: String(r.evidence_tier ?? ''),
            wada_status: String(r.wada_status ?? 'not_listed'),
            snippet:
              String(r.plain_summary ?? '').slice(0, 160) +
              (String(r.plain_summary ?? '').length > 160 ? '...' : ''),
            score: typeof r.similarity === 'number' ? r.similarity : Number(r.similarity ?? 0),
            knowledge_panel_url: `/research/compounds/${String(r.slug ?? '')}`,
          }));
        }
      }
    } catch (e) {
      console.error('Semantic search embedding failed:', e);
    }
  }

  let finalRows = rows;
  if (vectorRows.length > 0) {
    const mergedMap = new Map<string, SearchResultRow>();
    for (const vr of vectorRows) {
      mergedMap.set(vr.slug, vr);
    }
    for (const kr of rows) {
      const existing = mergedMap.get(kr.slug);
      if (existing) {
        existing.score = Math.max(existing.score, kr.score) + 0.1;
        if (kr.snippet) {
          existing.snippet = kr.snippet;
        }
      } else {
        mergedMap.set(kr.slug, kr);
      }
    }
    finalRows = Array.from(mergedMap.values()).sort((a, b) => b.score - a.score);
    total = finalRows.length;
  }

  return { finalRows, total, parsed };
}

async function handle(req: NextRequest, q: string, limit: number, offset: number) {
  const t0 = Date.now();
  const trimmed = (q || '').trim();
  if (!trimmed) {
    return NextResponse.json(
      {
        results: [],
        total: 0,
        latencyMs: 0,
        note: RESEARCH_NOTE,
        filters_applied: [],
      },
      { status: 200 },
    );
  }

  const supabase = await createServiceClient();

  const { data: catalogData } = await supabase
    .from('compounds')
    .select('slug, display_name, aliases, research_areas, category');
  const catalog = (catalogData ?? []) as Array<{
    slug: string;
    display_name: string;
    aliases: string[] | null;
    research_areas: string[] | null;
    category: string | null;
  }>;

  const autoCorrect = req.nextUrl.searchParams.get('autoCorrect') !== 'false';
  let { finalRows, total, parsed } = await performSearch(supabase, trimmed, limit, offset);

  let correctedQuery: string | null = null;
  let originalQuery: string | null = null;

  if (finalRows.length === 0 && autoCorrect) {
    const correction = findFuzzyCorrection(trimmed, catalog);
    if (correction) {
      correctedQuery = correction.display_name;
      originalQuery = trimmed;
      const correctedResult = await performSearch(supabase, correction.display_name, limit, offset);
      finalRows = correctedResult.finalRows;
      total = correctedResult.total;
      parsed = correctedResult.parsed;
    }
  }

  const intent = classifyIntent(parsed, { catalog });
  const latencyMs = Date.now() - t0;
  const topSlug = finalRows[0]?.slug ?? null;

  after(async () => {
    await logSearchQuery(supabase, parsed, intent, total, topSlug, latencyMs);
  });

  return NextResponse.json(
    {
      results: finalRows,
      intent,
      total,
      latencyMs,
      note: RESEARCH_NOTE,
      filters_applied: parsed.filters,
      correctedQuery,
      originalQuery,
    },
    { status: 200 },
  );
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const limit = Math.max(
    1,
    Math.min(50, Number(req.nextUrl.searchParams.get('limit') ?? '20') || 20),
  );
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get('offset') ?? '0') || 0);
  return handle(req, q, limit, offset);
}

export async function POST(req: NextRequest) {
  let q = '';
  let limit = 20;
  let offset = 0;
  try {
    const body = (await req.json()) as { q?: string; limit?: number; offset?: number };
    q = typeof body?.q === 'string' ? body.q : '';
    if (typeof body?.limit === 'number') limit = body.limit;
    if (typeof body?.offset === 'number') offset = body.offset;
  } catch {
    q = req.nextUrl.searchParams.get('q') ?? '';
  }
  limit = Math.max(1, Math.min(50, limit));
  offset = Math.max(0, offset);
  return handle(req, q, limit, offset);
}
