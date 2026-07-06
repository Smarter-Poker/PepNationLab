import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { safeError } from '@/lib/api-error';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  // Auth check: only authenticated users may log missed searches.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { query } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid query' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { error } = await supabase.from('missed_searches').insert({
      query: query.trim().slice(0, 500),
      source: 'storefront'
    });

    if (error) {
      console.error('[Missed Searches Analytics] Failed to insert', error);
      return safeError('analytics.missed_search', error);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
