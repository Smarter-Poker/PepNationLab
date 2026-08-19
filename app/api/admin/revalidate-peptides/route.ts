import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

/**
 * POST /api/admin/revalidate-peptides
 *
 * Force-purges the cached render of the ENTIRE /peptides tree (hub, 50 state
 * hubs, all city pages, compound-city pages) in one call.
 *
 * Why this exists: the 2026-08-14 SEO audit caught a canonical city URL
 * (/peptides/california/beverly-hills) serving months-stale pre-enrichment
 * HTML — including a compliance-banned "pharmaceutical-grade" claim — despite
 * the route's revalidate=300. The ISR/data cache can outlive deploys, so any
 * time city-page content or SEO policy changes (titles, noindex tiers,
 * removed sections), hit this endpoint to guarantee Google's next crawl sees
 * the current version rather than re-indexing a stale one.
 *
 * Auth: same Bearer CRON_SECRET pattern as the cron routes. Never expose
 * unauthenticated — mass revalidation is a cheap DoS lever.
 *
 *   curl -X POST https://pepnationlab.com/api/admin/revalidate-peptides \
 *        -H "Authorization: Bearer $CRON_SECRET"
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET Not Configured' }, { status: 503 });
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 'layout' scope invalidates the segment and everything beneath it — the
  // hub, every state, every city, every compound-city page — without
  // enumerating 2,400+ paths.
  revalidatePath('/peptides', 'layout');
  // The sitemap must repopulate in the same sweep so it never advertises
  // URLs whose robots policy just changed.
  revalidatePath('/sitemap.xml');

  return NextResponse.json({
    success: true,
    revalidated: ['/peptides (layout scope: hub, states, cities, compound pages)', '/sitemap.xml'],
    at: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

// Vercel cron invocations arrive as GET with the same Bearer CRON_SECRET
// header. The daily schedule in vercel.json is the standing defense against
// the stale-edge-cache bug (audit: a canonical city URL served months-old
// pre-enrichment HTML despite revalidate=300).
export async function GET(req: NextRequest) {
  return handle(req);
}
