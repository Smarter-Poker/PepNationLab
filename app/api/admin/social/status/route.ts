import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSocialStatus } from '@/lib/social/admin';

/**
 * Admin-only: connection + queue status for the social autoposter console.
 *
 *   GET /api/admin/social/status
 *
 * Returns, per provider, whether an account is connected and whether its token
 * is expired / refreshable. NEVER returns token values (see lib/social/admin).
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const status = await getSocialStatus();
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could Not Load Status' },
      { status: 500 },
    );
  }
}
