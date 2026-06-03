import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    if (!payload || !payload.results) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from('shared_research_protocols')
      .insert({ payload })
      .select('id')
      .single();

    if (error || !data) {
      console.error('[Share Protocol] Insert error', error);
      return NextResponse.json({ error: 'Failed to save protocol' }, { status: 500 });
    }

    // Determine base URL dynamically or from env
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || 'https://pepnationlab.com';
    
    // We assume the frontend is mounted under a brand (e.g. /savagebrands).
    // The frontend code calling this will use window.location to construct the final URL,
    // so we just return the raw ID and a relative path hint.
    return NextResponse.json({ 
      id: data.id,
      url: `${baseUrl}/shared/${data.id}` 
    });
  } catch (error) {
    console.error('[Share Protocol] Unhandled error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
