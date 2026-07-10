/**
 * /api/seo/indexnow - trigger IndexNow submission (Bing, Yandex, Seznam, etc.).
 *
 * GET  Submits the full set of important public URLs - key pages, every
 *      compound monograph, and every comparison page - so new/updated content
 *      is discovered within minutes instead of waiting for organic crawl.
 *      Wired to a daily Vercel cron (see vercel.json). Also safe to hit
 *      manually. Bing feeds ChatGPT search, so this also shortens AI
 *      answer-engine discovery time.
 * POST { "urls": ["https://pepnationlab.com/research/bpc-157", ...] }
 *      Submits a specific set of canonical URLs (e.g. after publishing).
 *
 * Only URLs on the canonical host are ever submitted (enforced in the helper).
 */

import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { pingIndexNow } from '@/lib/indexnow';
import { getAllCompounds } from '@/lib/compounds-server';
import { COMPARISON_PAIRS, matchupSlug } from '@/lib/research/comparisons';
import { CITIES, getStatesSlugs } from '@/lib/cities/cities-data';
import { GUIDES } from '@/lib/research/guides';

const BASE = 'https://pepnationlab.com';

const STATIC_PATHS = [
  '/',
  '/research',
  '/find-a-peptide',
  '/peptide-101',
  '/research/catalog',
  '/research/a-z',
  '/research/areas',
  '/research/glossary',
  '/research/calculators',
  '/research/compare',
  '/research/faq',
  '/research/methodology',
  '/research/guides',
  // Indexable, content-rich tool page (How-It-Works + FAQPage schema). It is in
  // robots' allow list and the sitemap, but was never submitted to IndexNow.
  '/research/match',
  '/peptides',
  '/researchstore',
];

async function importantUrls(): Promise<string[]> {
  const urls = new Set<string>();
  for (const p of STATIC_PATHS) urls.add(`${BASE}${p}`);
  for (const pair of COMPARISON_PAIRS) urls.add(`${BASE}/research/compare/${matchupSlug(pair.a, pair.b)}`);
  // Local-SEO surface: every state hub and every city landing page. These
  // were previously missing, so Bing/Yandex (and the AI answer engines that
  // read Bing's index) never got pinged about the city build-out at all.
  // IndexNow accepts up to 10,000 URLs per submission - the full set here
  // is well under 1,000.
  for (const stateSlug of getStatesSlugs()) urls.add(`${BASE}/peptides/${stateSlug}`);
  for (const city of CITIES) urls.add(`${BASE}/peptides/${city.stateSlug}/${city.slug}`);
  for (const guide of GUIDES) urls.add(`${BASE}/research/guides/${guide.slug}`);
  try {
    const all = await getAllCompounds();
    for (const c of all) urls.add(`${BASE}/research/${c.slug}`);
  } catch {
    /* fail-soft: still submit the static + comparison set */
  }
  return Array.from(urls);
}

export async function POST(request: Request) {
  // Per-IP throttle: the submitted URLs are host-restricted in the helper (so no
  // arbitrary-domain abuse), but an unthrottled public POST could still be used
  // to hammer the IndexNow endpoints and risk key throttling. Match the limits
  // the other public analytics endpoints use.
  const limited = await rateLimit({
    key: 'indexnow_submit',
    limit: 10,
    windowSeconds: 60,
    identifier: getClientIp(request),
  });
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Too Many Requests. Please Wait And Try Again.' }, { status: 429 });
  }

  let urls: string[] = [];
  try {
    const body = await request.json();
    if (Array.isArray(body?.urls)) {
      // Validate: only accept string entries, max 500 URLs per call
      urls = body.urls.filter((u: unknown) => typeof u === 'string').slice(0, 500) as string[];
    }
  } catch {
    urls = [];
  }
  const result = await pingIndexNow(urls);
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  // Guard: only Vercel cron scheduler (via CRON_SECRET) or a manual admin call should
  // trigger a full-site IndexNow submission. Unauthenticated hits would exhaust the
  // IndexNow API key rate budget.
  const authHeader = (request as any).headers?.get?.('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET ?? '';
  const isVercelCron = (request as any).headers?.get?.('x-vercel-cron') === '1';
  if (!isVercelCron && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const urls = await importantUrls();
  const result = await pingIndexNow(urls);
  return NextResponse.json({ ...result, urlCount: urls.length });
}
