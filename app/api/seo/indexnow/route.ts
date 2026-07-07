/**
 * /api/seo/indexnow - trigger IndexNow submission.
 *
 * POST { "urls": ["https://pepnationlab.com/research/bpc-157", ...] }
 *   Submits the given canonical URLs to IndexNow (Bing/Yandex/etc).
 *
 * GET  Submits a small default set (home + research hub) as a smoke test /
 *   heartbeat. Safe to call from a Vercel cron on a schedule.
 *
 * Only URLs on the canonical host are ever submitted (enforced in the helper).
 */

import { NextResponse } from 'next/server';
import { pingIndexNow } from '@/lib/indexnow';

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
  const result = await pingIndexNow([
    'https://pepnationlab.com',
    'https://pepnationlab.com/research',
  ]);
  return NextResponse.json(result);
}
