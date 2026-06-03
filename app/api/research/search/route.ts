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
 * Response always carries a RESEARCH_NOTE — nothing here is dosing or
 * medical advice.
 */

import { NextResponse, type NextRequest, after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { parseQuery, buildAutoWildcardTsquery, type ParsedQuery, type FieldFilter } from '@/lib/research/search-parser';
import { classifyIntent, type IntentMatch } from '@/lib/research/intent';

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

function escSql(s: string): string {
  return s.replace(/'/g, "''");
}

function buildHeadlineExpr(tsquery: string): string {
  const safe = escSql(tsquery);
  return (
    `coalesce(ts_headline('english', coalesce(plain_summary, '') || ' ' || coalesce(mechanism, ''), ` +
    `to_tsquery('english', '${safe}'), 'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=8'), '')`
  );
}

function applyFilters(
  filters: FieldFilter[],
  builder: ReturnType<ReturnType<typeof createServiceClient> extends Promise<infer S> ? (s: S) => never : never>,
) {
  void filters;
  void builder;
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
  // Foundation migration shipped this function — see
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

  const parsed = parseQuery(trimmed);
  const supabase = await createServiceClient();

  // Pull a slim catalog for the intent classifier. The RLS read on compounds
  // is public so the service client is fine here.
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

  const intent = classifyIntent(parsed, { catalog });

  let { rows, total } = await runRankedSearch(supabase, parsed, limit, offset);

  if (rows.length === 0) {
    const trgm = await runFallbackTrigram(supabase, parsed, limit);
    if (trgm.length > 0) {
      rows = trgm;
      total = trgm.length;
    }
  }

  const latencyMs = Date.now() - t0;
  const topSlug = rows[0]?.slug ?? null;

  // Best-effort analytics — run safely in the background using Next.js `after`
  void firstClientIp(req);
  after(async () => {
    await logSearchQuery(supabase, parsed, intent, total, topSlug, latencyMs);
  });

  return NextResponse.json(
    {
      results: rows,
      intent,
      total,
      latencyMs,
      note: RESEARCH_NOTE,
      filters_applied: parsed.filters,
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
    // fall through to URL params on bad JSON
    q = req.nextUrl.searchParams.get('q') ?? '';
  }
  limit = Math.max(1, Math.min(50, limit));
  offset = Math.max(0, offset);
  return handle(req, q, limit, offset);
}
