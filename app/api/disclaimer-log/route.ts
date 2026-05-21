import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient();

  const body = await req.json().catch(() => ({}));
  const { layer = 'site_entry', disclaimer_version = 'v1.0', user_id = null } = body;

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null;

  const userAgent = req.headers.get('user-agent') ?? null;

  await supabase.from('disclaimer_acceptances').insert({
    user_id,
    disclaimer_version,
    layer,
    ip_address: ip,
    user_agent: userAgent,
  });

  return NextResponse.json({ ok: true });
}
