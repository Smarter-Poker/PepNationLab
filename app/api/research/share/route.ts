import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);

  try {
    const payload = await req.json();
    if (!payload || !payload.results) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Inject user.id if logged in, for potential future ownership tracking
    if (user) {
      payload.user_id = user.id;
    }

    const serviceClient = await createServiceClient();
    const { data, error } = await serviceClient
      .from('shared_research_protocols')
      .insert({ payload })
      .select('id')
      .maybeSingle();

    if (error || !data) {
      console.error('[Share Protocol] Insert error', error);
      return NextResponse.json({ error: 'Failed to save protocol' }, { status: 500 });
    }

    const brandId = typeof payload.brandId === 'string' ? payload.brandId.replace(/[^a-zA-Z0-9-]/g, '') : 'pepnation';
    const cleanBrandId = brandId || 'pepnation';

    return NextResponse.json({ 
      id: data.id,
      url: `/${cleanBrandId}/shared/${data.id}` 
    });
  } catch (error) {
    console.error('[Share Protocol] Unhandled error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
