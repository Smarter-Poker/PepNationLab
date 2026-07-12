import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';
import { z } from 'zod';

const PatchSchema = z.object({
  label: z.string().max(80).nullable().optional(),
  full_name: z.string().min(1).max(120).optional(),
  street1: z.string().min(1).max(200).optional(),
  street2: z.string().max(200).nullable().optional(),
  city: z.string().min(1).max(120).optional(),
  state: z.string().min(1).max(60).optional(),
  zip: z.string().min(1).max(20).optional(),
  country: z.string().min(2).max(60).optional(),
  is_ship_to: z.boolean().optional(),
  is_ship_from: z.boolean().optional(),
});

const FIELDS =
  'id, label, full_name, street1, street2, city, state, zip, country, is_default, is_default_from, is_ship_to, is_ship_from, created_at, updated_at';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.is_ship_to === false && parsed.data.is_ship_from === false) {
    return NextResponse.json({ error: 'must_be_at_least_one_kind' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('saved_addresses')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select(FIELDS)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('saved_addresses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
