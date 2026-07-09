import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSocialQueue } from '@/lib/social/admin';

/**
 * Admin-only: list rows from the social publishing queue.
 *
 *   GET /api/admin/social/queue?status=pending&limit=50
 *
 * status is optional; omit for all. Returns non-secret columns only.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const limitRaw = parseInt(url.searchParams.get('limit') ?? '50', 10);

  try {
    const posts = await getSocialQueue(status, limitRaw);
    return NextResponse.json({ posts });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could Not Load Queue' },
      { status: 500 },
    );
  }
}
