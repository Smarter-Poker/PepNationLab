import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
// Cache for 5 minutes at the CDN level — count doesn't need to be real-time
export const revalidate = 300;

/**
 * GET /api/stats/member-count
 *
 * Returns the total number of approved researcher profiles.
 * Used by GuestCTA as social proof. Publicly accessible (no auth required).
 * Response is cached for 5 minutes to avoid hitting Supabase on every page load.
 */
export async function GET() {
  try {
    const svc = await createServiceClient();

    const { count, error } = await svc
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'researcher')
      .eq('is_approved', true);

    if (error) throw error;

    return NextResponse.json(
      { count: count ?? 0 },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        },
      }
    );
  } catch {
    // Best-effort — return a reasonable placeholder so the UI still renders cleanly
    return NextResponse.json({ count: null }, { status: 200 });
  }
}
