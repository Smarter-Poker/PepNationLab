import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { z } from 'zod';

const AddressSchema = z.object({
  label: z.string().max(80).nullable().optional(),
  full_name: z.string().min(1).max(120),
  street1: z.string().min(1).max(200),
  street2: z.string().max(200).nullable().optional(),
  city: z.string().min(1).max(120),
  state: z.string().min(1).max(60),
  zip: z.string().min(1).max(20),
  country: z.string().min(2).max(60).default('US'),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('saved_addresses')
    .select('id, label, full_name, street1, street2, city, state, zip, country, is_default, created_at, updated_at')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = AddressSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 });

  const { count } = await supabase
    .from('saved_addresses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { data, error } = await supabase
    .from('saved_addresses')
    .insert({
      user_id: user.id,
      label: parsed.data.label ?? null,
      full_name: parsed.data.full_name,
      street1: parsed.data.street1,
      street2: parsed.data.street2 ?? null,
      city: parsed.data.city,
      state: parsed.data.state,
      zip: parsed.data.zip,
      country: parsed.data.country,
      is_default: (count ?? 0) === 0,
    })
    .select('id, label, full_name, street1, street2, city, state, zip, country, is_default, created_at, updated_at')
    .single();

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ data });
}
