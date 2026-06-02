import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { isValidStateCode } from '@/lib/us-states';

/**
 * Saved addresses for researchers.
 * RLS on `saved_addresses` confines reads/writes to the authenticated owner,
 * so we lean on it here. All write methods do a defensive CSRF same-origin
 * check on top.
 */

interface AddressBody {
  label?: string | null;
  full_name?: string;
  street1?: string;
  street2?: string | null;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  is_default?: boolean;
}

async function getAuthedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, userId: user.id };
}

function validateRequired(body: AddressBody): string | null {
  if (!body.full_name || typeof body.full_name !== 'string' || !body.full_name.trim()) {
    return 'Full Name Is Required.';
  }
  if (!body.street1 || typeof body.street1 !== 'string' || !body.street1.trim()) {
    return 'Street Address Is Required.';
  }
  if (!body.city || typeof body.city !== 'string' || !body.city.trim()) {
    return 'City Is Required.';
  }
  if (!body.state || typeof body.state !== 'string' || !isValidStateCode(body.state)) {
    return 'A Valid US State Is Required.';
  }
  if (!body.zip || typeof body.zip !== 'string' || !/^\d{5}(-\d{4})?$/.test(body.zip.trim())) {
    return 'A Valid US Zip Code Is Required.';
  }
  return null;
}

export async function GET() {
  const auth = await getAuthedClient();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await auth.supabase
    .from('saved_addresses')
    .select('id, label, full_name, street1, street2, city, state, zip, country, is_default, created_at, updated_at')
    .eq('user_id', auth.userId)
    // Round 25: checkout only wants SHIP-TO eligible addresses. Researchers may
    // now save ship-from-only addresses from /account/addresses; those would
    // otherwise pollute the checkout picker.
    .eq('is_ship_to', true)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const csrfFail = assertSameOrigin(req);
  if (csrfFail) return csrfFail;

  const auth = await getAuthedClient();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as AddressBody;
  const validationError = validateRequired(body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const stateCode = (body.state as string).toUpperCase();
  const country = (body.country || 'US').toUpperCase().slice(0, 2);
  const makeDefault = Boolean(body.is_default);

  if (makeDefault) {
    const { error: clearErr } = await auth.supabase
      .from('saved_addresses')
      .update({ is_default: false })
      .eq('user_id', auth.userId)
      .eq('is_default', true);
    if (clearErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  const { data, error } = await auth.supabase
    .from('saved_addresses')
    .insert({
      user_id: auth.userId,
      label: body.label?.toString().trim() || null,
      full_name: body.full_name!.trim(),
      street1: body.street1!.trim(),
      street2: body.street2?.toString().trim() || null,
      city: body.city!.trim(),
      state: stateCode,
      zip: body.zip!.trim(),
      country,
      is_default: makeDefault,
    })
    .select('id, label, full_name, street1, street2, city, state, zip, country, is_default, created_at, updated_at')
    .single();

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const csrfFail = assertSameOrigin(req);
  if (csrfFail) return csrfFail;

  const auth = await getAuthedClient();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as AddressBody & { id?: string };
  if (!body.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Address ID Is Required.' }, { status: 400 });
  }

  if (body.state !== undefined && body.state !== null) {
    if (typeof body.state !== 'string' || !isValidStateCode(body.state)) {
      return NextResponse.json({ error: 'A Valid US State Is Required.' }, { status: 400 });
    }
  }
  if (body.zip !== undefined && body.zip !== null) {
    if (typeof body.zip !== 'string' || !/^\d{5}(-\d{4})?$/.test(body.zip.trim())) {
      return NextResponse.json({ error: 'A Valid US Zip Code Is Required.' }, { status: 400 });
    }
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (body.label !== undefined) updates.label = body.label?.toString().trim() || null;
  if (body.full_name !== undefined) updates.full_name = (body.full_name || '').trim();
  if (body.street1 !== undefined) updates.street1 = (body.street1 || '').trim();
  if (body.street2 !== undefined) updates.street2 = body.street2?.toString().trim() || null;
  if (body.city !== undefined) updates.city = (body.city || '').trim();
  if (body.state !== undefined) updates.state = (body.state as string).toUpperCase();
  if (body.zip !== undefined) updates.zip = (body.zip || '').trim();
  if (body.country !== undefined) updates.country = (body.country || 'US').toUpperCase().slice(0, 2);

  if (body.is_default === true) {
    const { error: clearErr } = await auth.supabase
      .from('saved_addresses')
      .update({ is_default: false })
      .eq('user_id', auth.userId)
      .eq('is_default', true)
      .neq('id', body.id);
    if (clearErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    updates.is_default = true;
  } else if (body.is_default === false) {
    updates.is_default = false;
  }

  const { data, error } = await auth.supabase
    .from('saved_addresses')
    .update(updates)
    .eq('id', body.id)
    .eq('user_id', auth.userId)
    .select('id, label, full_name, street1, street2, city, state, zip, country, is_default, created_at, updated_at')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Address Not Found.' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  const csrfFail = assertSameOrigin(req);
  if (csrfFail) return csrfFail;

  const auth = await getAuthedClient();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({} as { id?: string }));
  if (!body.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Address ID Is Required.' }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from('saved_addresses')
    .delete()
    .eq('id', body.id)
    .eq('user_id', auth.userId);

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
