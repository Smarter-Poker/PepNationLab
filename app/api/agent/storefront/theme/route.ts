// R24 phase 6 - Storefront theme builder API.
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
    .from('agent_profiles')
    .select('primary_color, secondary_color, accent_color, tagline, hero_image_url, theme_config, logo_url, slug, display_name')
    .eq('id', user.id)
    .maybeSingle();
  return NextResponse.json({ theme: data ?? null });
}

const Body = z.object({
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  tagline: z.string().max(200).optional().nullable(),
  hero_image_url: z.string().url().optional().nullable(),
  theme_config: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(req: Request) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) return csrf;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e: any) { return NextResponse.json({ error: 'bad_request', details: e.errors }, { status: 400 }); }
  const svc = await createServiceClient();
  const { error } = await svc
    .from('agent_profiles')
    .update(body)
    .eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
