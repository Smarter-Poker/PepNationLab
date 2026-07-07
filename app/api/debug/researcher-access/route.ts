import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * GET /api/debug/researcher-access
 * Admin-only diagnostic: returns the requesting user's role and storefront routing data.
 * Originally a temporary debug endpoint - restricted to admins and retained for
 * operational troubleshooting only.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  return NextResponse.json({ message: 'Use the admin panel to inspect researcher profiles.' });
}
