/**
 * /api/seo/indexnow - trigger IndexNow submission (Bing, Yandex, Seznam, etc.).
 *
 * GET  Submits the full set of important public URLs — key pages, every
 *      compound monograph, and every comparison page — so new/updated content
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
import { pingIndexNow } from '@/lib/indexnow';
import { getAllCompounds } from '@/lib/compounds-server';
import { COMPARISON_PAIRS, matchupSlug } from '@/lib/research/comparisons';

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
  '/peptides',
];

async function importantUrls(): Promise<string[]> {
  const urls = new Set<string>();
  for (const p of STATIC_PATHS) urls.add(`${BASE}${p}`);
  for (const pair of COMPARISON_PAIRS) urls.add(`${BASE}/research/compare/${matchupSlug(pair.a, pair.b)}`);
  try {
    const all = await getAllCompounds();
    for (const c of all) urls.add(`${BASE}/research/${c.slug}`);
  } catch {
    /* fail-soft: still submit the static + comparison set */
  }
  return Array.from(urls);
}

export async function POST(request: Request) {
  let urls: string[] = [];
  try {
    const body = await request.json();
    if (Array.isArray(body?.urls)) urls = body.urls as string[];
  } catch {
    urls = [];
  }
  const result = await pingIndexNow(urls);
  return NextResponse.json(result);
}

export async function GET() {
  const urls = await importantUrls();
  const result = await pingIndexNow(urls);
  return NextResponse.json({ ...result, urlCount: urls.length });
}
