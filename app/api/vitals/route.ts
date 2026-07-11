// Web Vitals RUM sink. Receives fire-and-forget Core Web Vitals reports from the
// browser (components/WebVitalsReporter) and stores them in web_vitals via the
// service role. Same-origin only, rate limited, every field clamped, best-effort
// auth attribution, never throws, always returns 204 so it never affects the
// page it is measuring.
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_METRICS = new Set(['LCP', 'CLS', 'INP', 'FCP', 'TTFB', 'FID']);

function clamp(v: unknown, n: number): string | null {
  if (typeof v !== 'string' || !v) return null;
  return v.slice(0, n);
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  // A page load emits a handful of metrics; keep the ceiling generous but real.
  const ip = getClientIp(req);
  const rl = await rateLimit({ key: 'web_vitals', limit: 120, windowSeconds: 60, identifier: ip });
  if (!rl.allowed) return new NextResponse(null, { status: 204 });

  try {
    const body = await req.json().catch(() => null);
    const metric = clamp(body?.metric, 12);
    const value = Number(body?.value);
    if (!metric || !ALLOWED_METRICS.has(metric) || !Number.isFinite(value)) {
      return new NextResponse(null, { status: 204 });
    }

    let userId: string | null = null;
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    } catch {
      // anonymous reports are expected (guests on the landing page)
    }

    const service = await createServiceClient();
    await service.from('web_vitals').insert({
      user_id: userId,
      metric,
      // CLS is a small ratio; others are ms. Round to avoid float dust.
      value: Math.round(value * 1000) / 1000,
      rating: clamp(body?.rating, 20),
      path: clamp(body?.path, 300),
      navigation_type: clamp(body?.navigation_type, 20),
      metric_id: clamp(body?.metric_id, 60),
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    // Never let observability affect the page.
    return new NextResponse(null, { status: 204 });
  }
}
