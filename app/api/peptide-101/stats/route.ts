/**
 * Live course stats for Peptide 101 - currently the size of the research
 * library, so the course always reflects the real catalog. Auth-gated (the
 * course is behind login). Read-only count, no PII.
 *   GET -> { compounds: number }
 */
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const svc = await createServiceClient();
    const { count, error } = await svc
      .from('compounds')
      .select('id', { count: 'exact', head: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ compounds: count ?? 0 });
  } catch {
    return NextResponse.json({ error: 'stats_failed' }, { status: 500 });
  }
}
