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
      // NOTE: profiles has no is_approved column — filtering on it made every
      // query error, so this endpoint permanently returned { count: null }.
      // Active researchers is the correct population for social proof.
      .eq('is_active', true);

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
