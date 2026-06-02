// R24 phase 6 — Custom domains.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const svc = await createServiceClient();
  const { data } = await svc
    .from('agent_domains')
    .select('id, hostname, status, verified_at, created_at')
    .eq('agent_id', user.id)
    .order('created_at', { ascending: false });
  return NextResponse.json({ domains: data ?? [] });
}

const Body = z.object({
  hostname: z.string().regex(/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)$/i).max(253),
});

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) return csrf;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e: any) { return NextResponse.json({ error: 'bad_request', details: e.errors }, { status: 400 }); }
  const svc = await createServiceClient();
  const { data, error } = await svc
    .from('agent_domains')
    .insert({ agent_id: user.id, hostname: body.hostname.toLowerCase(), status: 'pending' })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'hostname_taken' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, domain: data });
}
