
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * fix-52: zero-result admin search logger.
 *
 * The /admin/search client posts here when a query returns nothing across
 * every entity. The admin_search_no_results_log table backs an internal
 * "what are admins looking for that we don't have" report. Strictly
 * fire-and-forget - every error path returns 204 so the client UI never
 * has to handle a failure.
 */
export async function POST(req: NextRequest) {
  // CSRF: state-changing route must be same-origin (platform rule).
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const admin = await requireAdmin();
  if (!admin.ok) {
    return new NextResponse(null, { status: 204 });
  }

  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'admin_search_log',
    limit: 30,
    windowSeconds: 60,
    identifier: admin.userId || ip,
  });
  if (!limited.allowed) return new NextResponse(null, { status: 204 });

  let body: { query?: unknown; scope?: unknown; filters?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const query = String(body.query ?? '').slice(0, 200).trim();
  if (query.length < 2) return new NextResponse(null, { status: 204 });

  const scope = String(body.scope ?? 'all').slice(0, 32);
  const filters =
    body.filters && typeof body.filters === 'object' && !Array.isArray(body.filters)
      ? (body.filters as Record<string, unknown>)
      : null;
  const ua = req.headers.get('user-agent')?.slice(0, 400) ?? null;

  try {
    const svc = await createServiceClient();
    await svc.from('admin_search_no_results_log').insert({
      admin_id: admin.userId ?? null,
      query,
      scope,
      // @ts-expect-error Database schema mismatch from generated types
      filters,
      user_agent: ua,
    });
  } catch {
    // logger - never fail loud
  }

  return new NextResponse(null, { status: 204 });
}
