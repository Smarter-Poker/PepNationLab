// R24 phase 6 - Storefront theme builder API.
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
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
    .from('agent_profiles')
    .select('primary_color, secondary_color, accent_color, tagline, hero_image_url, theme_config, logo_url, slug, display_name')
    .eq('id', gate.user.id)
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
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e: any) { return NextResponse.json({ error: 'bad_request', details: e.errors }, { status: 400 }); }
  const svc = await createServiceClient();
  // .select('slug') rides along on the UPDATE (no extra round-trip) so the
  // per-store catalog tag can be busted below.
  const { data, error } = await svc
    .from('agent_profiles')
    .update((body) as any)
    .eq('id', gate.user.id)
    .select('slug')
    .maybeSingle();
  if (error) return safeError('storefront.theme', error, 400);

  // primary_color feeds the public catalog payload - purge this store's
  // cached catalog (plus the global tag) so the theme change shows.
  try {
    revalidateTag('storefront-catalog', { expire: 0 });
    if (data?.slug) revalidateTag('catalog:' + data.slug, { expire: 0 });
  } catch { /* best-effort cache refresh */ }

  return NextResponse.json({ ok: true });
}
