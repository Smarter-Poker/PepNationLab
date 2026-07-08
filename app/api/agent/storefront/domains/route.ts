// R24 phase 6 - Custom domains.
import { NextResponse } from 'next/server';
import { safeError } from '@/lib/api-error';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireAgentOrAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;
  const svc = await createServiceClient();
  const { data } = await svc
    .from('agent_domains')
    .select('id, hostname, status, verified_at, created_at')
    .eq('agent_id', gate.user.id)
    .order('created_at', { ascending: false });
  return NextResponse.json({ domains: data ?? [] });
}

const Body = z.object({
  hostname: z.string().regex(/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)$/i).max(253),
});

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) return csrf;
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e: any) { return NextResponse.json({ error: 'bad_request', details: e.errors }, { status: 400 }); }
  const svc = await createServiceClient();
  const { data, error } = await svc
    .from('agent_domains')
    .insert({ agent_id: gate.user.id, hostname: body.hostname.toLowerCase(), status: 'pending' })
    .select()
    .maybeSingle();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'hostname_taken' }, { status: 409 });
    return safeError('storefront.domains', error, 400);
  }
  return NextResponse.json({ ok: true, domain: data });
}
