import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

/** GET: List favorites | POST: Add favorite | DELETE: Remove favorite */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from('researcher_favorites')
    .select('product_id, created_at, products:product_id(id, name, image_url, category, is_active)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ favorites: data });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { productId } = body;
  if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 });

  const service = await createServiceClient();
  const { error } = await service.from('researcher_favorites').upsert(
    { user_id: user.id, product_id: productId },
    { onConflict: 'user_id,product_id' }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { productId } = body;
  if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 });

  const service = await createServiceClient();
  const { error } = await service.from('researcher_favorites').delete()
    .eq('user_id', user.id)
    .eq('product_id', productId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
