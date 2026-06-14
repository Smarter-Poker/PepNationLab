import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

const DEFAULT_SHELF_DAYS = 28;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('reconstitution_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed To Load Logs' }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid Request Body' }, { status: 400 });
  }

  const compoundSlug = typeof body.compound_slug === 'string' ? body.compound_slug.trim() : '';
  if (!compoundSlug) {
    return NextResponse.json({ error: 'Compound Slug Is Required' }, { status: 400 });
  }

  const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim() : null;
  const productId =
    typeof body.product_id === 'string' && body.product_id.trim() ? body.product_id.trim() : null;

  let reconstitutedOn = todayISO();
  if (typeof body.reconstituted_on === 'string' && body.reconstituted_on.trim()) {
    const parsed = new Date(body.reconstituted_on);
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'Invalid Reconstitution Date' }, { status: 400 });
    }
    reconstitutedOn = body.reconstituted_on.slice(0, 10);
  }

  let shelfDays = DEFAULT_SHELF_DAYS;
  if (body.shelf_days !== undefined && body.shelf_days !== null) {
    const n = Number(body.shelf_days);
    if (!Number.isFinite(n) || n <= 0 || n > 3650) {
      return NextResponse.json({ error: 'Invalid Shelf Days' }, { status: 400 });
    }
    shelfDays = Math.round(n);
  }

  const { data, error } = await supabase
    .from('reconstitution_logs')
    .insert({
      user_id: user.id,
      compound_slug: compoundSlug,
      product_id: productId,
      label,
      reconstituted_on: reconstitutedOn,
      shelf_days: shelfDays,
    })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Failed To Save Log' }, { status: 500 });
  }

  return NextResponse.json({ log: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || !UUID_REGEX.test(id)) return NextResponse.json({ error: 'Valid Log Id Is Required' }, { status: 400 });

  // Owner RLS already restricts this; the explicit user_id filter is
  // defense-in-depth so a row can never be deleted by id alone.
  const { error } = await supabase
    .from('reconstitution_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Failed To Delete Log' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
