import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/social/generate-content
 *
 * Admin-triggered manual invocation of the social content generator.
 * Calls the same logic as the weekly cron (api/cron/social-content-gen)
 * but from the admin console, with full auth + CSRF. Useful for seeding
 * the queue before the first Sunday cron fires, or after clearing old posts.
 *
 * Returns: { inserted, skipped, weekOf }
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  if (process.env.SOCIAL_AUTOPOST_ENABLED !== 'true') {
    return NextResponse.json(
      { error: 'SOCIAL_AUTOPOST_ENABLED Is Not True. Enable It In Vercel Settings First.' },
      { status: 422 }
    );
  }

  // Delegate to the cron endpoint by re-using its core logic through the internal API.
  // The cron route does all the content generation + dedup insert, so we call it
  // with the CRON_SECRET rather than duplicating the logic here.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET Is Not Set In Vercel' }, { status: 500 });
  }

  const origin = req.headers.get('origin') ?? req.nextUrl.origin;
  const cronUrl = `${origin}/api/cron/social-content-gen`;

  try {
    const res = await fetch(cronUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'X-Internal': '1',
      },
      signal: AbortSignal.timeout(25_000),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('[social/generate-content] cron returned error', res.status, body);
      return NextResponse.json(
        { error: body.error ?? `Generator Failed (HTTP ${res.status})` },
        { status: 502 }
      );
    }

    return NextResponse.json(body);
  } catch (err) {
    console.error('[social/generate-content] fetch error', err);
    return NextResponse.json(
      { error: 'Could Not Reach Content Generator' },
      { status: 500 }
    );
  }
}
