import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
