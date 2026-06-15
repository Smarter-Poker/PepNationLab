import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'storefront_semantic',
    limit: 120,
    windowSeconds: 60,
    identifier: ip,
  });
  if (!limited.allowed) {
    return NextResponse.json({ matches: {} }, { status: 429 });
  }

  // Vector/semantic search is disabled (no embedding provider configured).
  // Storefront search falls back to keyword ILIKE matching.
  return NextResponse.json({ matches: {} }, { status: 200 });
}
