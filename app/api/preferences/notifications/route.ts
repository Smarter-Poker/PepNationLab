import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

/** GET: Get prefs | PUT: Upsert prefs */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();
  const { data } = await service
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  // Return defaults if no prefs exist
  return NextResponse.json({
    preferences: data || {
      email_on_message: true,
      email_on_invoice: true,
      browser_push: true,
      mute_all: false,
      send_read_receipts: true,
    },
  });
}

export async function PUT(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const service = await createServiceClient();
  const { error } = await service.from('notification_preferences').upsert({
    user_id: user.id,
    email_on_message: body.email_on_message ?? true,
    email_on_invoice: body.email_on_invoice ?? true,
    browser_push: body.browser_push ?? true,
    mute_all: body.mute_all ?? false,
    send_read_receipts: body.send_read_receipts ?? true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
