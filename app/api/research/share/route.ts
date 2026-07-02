import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
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
      .maybeSingle();

    if (error || !data) {
      console.error('[Share Protocol] Insert error', error);
      return NextResponse.json({ error: 'Failed to save protocol' }, { status: 500 });
    }

    // The frontend code calling this will use window.location to construct the final URL,
    // so we just return the raw ID and a relative path hint that includes the brandId.
    const brandId = payload.brandId || 'pepnation';
    return NextResponse.json({ 
      id: data.id,
      url: `/${brandId}/shared/${data.id}` 
    });
  } catch (error) {
    console.error('[Share Protocol] Unhandled error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
