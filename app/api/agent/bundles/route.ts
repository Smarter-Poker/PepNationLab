
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { randomUUID } from 'crypto';

interface Bundle {
  id: string;
  name: string;
  description: string;
  product_ids: string[];
  discount_percent: number;
  is_active: boolean;
  created_at: string;
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAgentOrAdmin();
    if (!gate.ok) return gate.response;
    const supabase = await createServiceClient();
    const { data: profile } = await supabase
      .from('agent_profiles')
      .select('bundles_config')
      .eq('id', gate.user.id)
      .maybeSingle();
    return NextResponse.json({ data: profile?.bundles_config || [] });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;
  {
    const svc = await createServiceClient();
    const { data: caller } = await svc.from('profiles').select('is_sub_agent').eq('id', gate.user.id).maybeSingle();
    if ((caller as { is_sub_agent?: boolean | null } | null)?.is_sub_agent === true) {
      return NextResponse.json({ error: 'Sub-Agents Cannot Create Bundles. Bundles Belong To The Storefront-Owning Agent.' }, { status: 403 });
    }
  }
  const body = await req.json().catch(() => ({}));
  const { name, description, product_ids, discount_percent } = body;
  if (!name || !Array.isArray(product_ids) || product_ids.length < 2) {
    return NextResponse.json({ error: 'Bundle Name And At Least 2 Products Are Required' }, { status: 400 });
  }
  if (typeof name !== 'string' || name.trim().length > 100) {
    return NextResponse.json({ error: 'Bundle Name Too Long (Max 100 Characters)' }, { status: 400 });
  }
  if (description !== undefined && description !== null && (typeof description !== 'string' || description.length > 500)) {
    return NextResponse.json({ error: 'Bundle Description Too Long (Max 500 Characters)' }, { status: 400 });
  }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (product_ids.some((id: unknown) => typeof id !== 'string' || !UUID_RE.test(id))) {
    return NextResponse.json({ error: 'product_ids must be an array of valid UUIDs' }, { status: 400 });
  }
  if (product_ids.length > 20) {
    return NextResponse.json({ error: 'A bundle cannot contain more than 20 products' }, { status: 400 });
  }
  const supabase = await createServiceClient();
  // slug rides along on the existing read (no extra round-trip) so the
  // per-store catalog tag can be busted after the write.
  const { data: profile } = await supabase.from('agent_profiles').select('bundles_config, slug').eq('id', gate.user.id).maybeSingle();
  const existing: Bundle[] = profile?.bundles_config || []; // @ts-ignore
  const newBundle: Bundle = {
    id: randomUUID(),
    name: name.trim(),
    description: (description || '').trim(),
    product_ids,
    discount_percent: Math.min(Math.max(Number(discount_percent) || 0, 0), 90),
    is_active: true,
    created_at: new Date().toISOString(),
  };
  const updated = [...existing, newBundle];
  //  Database schema mismatch from generated types
  const { error } = await supabase.from('agent_profiles').update({ bundles_config: updated, updated_at: new Date().toISOString() }).eq('id', gate.user.id);
  if (error) return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
  // Bundles surface on the public storefront - purge this store's cached
  // catalog (plus the global tag) so the new bundle shows immediately.
  try {
    revalidateTag('storefront-catalog', { expire: 0 });
    if (profile?.slug) revalidateTag('catalog:' + profile.slug, { expire: 0 });
  } catch { /* best-effort cache refresh */ }
  return NextResponse.json({ success: true, bundle: newBundle });
}

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;
  const body = await req.json().catch(() => ({}));
  const { id, action } = body;
  if (!id) return NextResponse.json({ error: 'Bundle ID Required' }, { status: 400 });
  const VALID_PATCH_ACTIONS = ['toggle'] as const;
  if (!action || !VALID_PATCH_ACTIONS.includes(action)) {
    return NextResponse.json({ error: `Invalid action. Must be one of: ${VALID_PATCH_ACTIONS.join(', ')}` }, { status: 400 });
  }
  const supabase = await createServiceClient();
  // slug rides along on the existing read (no extra round-trip) for the
  // per-store catalog tag bust below.
  const { data: profile } = await supabase.from('agent_profiles').select('bundles_config, slug').eq('id', gate.user.id).maybeSingle();
  const existing: Bundle[] = profile?.bundles_config || []; // @ts-ignore
  const updated = existing.map(b => b.id === id ? { ...b, is_active: action === 'toggle' ? !b.is_active : b.is_active } : b);
  //  Database schema mismatch from generated types
  const { error } = await supabase.from('agent_profiles').update({ bundles_config: updated, updated_at: new Date().toISOString() }).eq('id', gate.user.id);
  if (error) return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
  // Bundle visibility toggled - purge this store's cached public catalog.
  try {
    revalidateTag('storefront-catalog', { expire: 0 });
    if (profile?.slug) revalidateTag('catalog:' + profile.slug, { expire: 0 });
  } catch { /* best-effort cache refresh */ }
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;
  const body = await req.json().catch(() => ({}));
  const { id } = body;
  if (!id) return NextResponse.json({ error: 'Bundle ID Required' }, { status: 400 });
  const supabase = await createServiceClient();
  // slug rides along on the existing read (no extra round-trip) for the
  // per-store catalog tag bust below.
  const { data: profile } = await supabase.from('agent_profiles').select('bundles_config, slug').eq('id', gate.user.id).maybeSingle();
  const existing: Bundle[] = profile?.bundles_config || []; // @ts-ignore
  const updated = existing.filter(b => b.id !== id);
  //  Database schema mismatch from generated types
  const { error } = await supabase.from('agent_profiles').update({ bundles_config: updated, updated_at: new Date().toISOString() }).eq('id', gate.user.id);
  if (error) return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
  // Bundle removed - purge this store's cached public catalog.
  try {
    revalidateTag('storefront-catalog', { expire: 0 });
    if (profile?.slug) revalidateTag('catalog:' + profile.slug, { expire: 0 });
  } catch { /* best-effort cache refresh */ }
  return NextResponse.json({ success: true });
}
