export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireManufacturer } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { generateQrDataUrl } from '@/lib/qr';
import { sanitizeUsername } from '@/lib/usernames';
import { seedStorefrontFromHousePrices } from '@/lib/seed-storefront';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pepnationlab.com';

/**
 * GET /api/manufacturer/agents
 * Returns all agents/super-agents parented under this manufacturer.
 */
export async function GET() {
  const gate = await requireManufacturer();
  if (!gate.ok) return gate.response;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, username, full_name, role, is_super_agent, is_active,
      commission_pct, tier, account_type, created_at,
      agent_profiles ( slug, display_name )
    `)
    .eq('parent_agent_id', gate.user.id)
    .in('role', ['agent', 'super_agent'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[manufacturer/agents GET]', error);
    return NextResponse.json({ error: 'Failed to load agents' }, { status: 500 });
  }

  // Attach 30-day GMV per agent
  const agentIds = (data ?? []).map((a) => a.id);
  let gmvMap: Record<string, number> = {};
  if (agentIds.length > 0) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: orders } = await supabase
      .from('orders')
      .select('agent_id, total')
      .in('agent_id', agentIds)
      .neq('status', 'cancelled')
      .gte('created_at', thirtyDaysAgo);
    for (const o of orders ?? []) {
      if (o.agent_id) gmvMap[o.agent_id] = (gmvMap[o.agent_id] ?? 0) + Number(o.total || 0);
    }
  }

  const agents = (data ?? []).map((a) => ({
    id: a.id,
    username: a.username,
    fullName: a.full_name,
    role: a.role,
    isSuperAgent: a.is_super_agent,
    isActive: a.is_active,
    commissionPct: a.commission_pct,
    tier: a.tier,
    accountType: a.account_type,
    createdAt: a.created_at,
    slug: (a.agent_profiles as any)?.slug ?? null,
    displayName: (a.agent_profiles as any)?.display_name ?? null,
    gmv30d: gmvMap[a.id] ?? 0,
  }));

  return NextResponse.json({ agents });
}

/**
 * POST /api/manufacturer/agents
 * Creates a new agent directly under this manufacturer.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireManufacturer();
  if (!gate.ok) return gate.response;

  const manufacturerId = gate.user.id;
  const supabase = createAdminClient();

  // Fetch manufacturer profile for validation
  const { data: mfrProfile } = await supabase
    .from('profiles')
    .select('id, full_name, is_super_agent')
    .eq('id', manufacturerId)
    .maybeSingle();

  if (!mfrProfile) {
    return NextResponse.json({ error: 'Manufacturer profile not found' }, { status: 404 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const {
    username, password, full_name, display_name, slug,
    tier = 'tier_1',
    account_type = 'prepaid',
    commission_pct,
    make_super_agent = false,
  } = body ?? {};

  if (!username || !password || !slug) {
    return NextResponse.json({ error: 'Username, password, and slug are required' }, { status: 400 });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const usernameClean = sanitizeUsername(username);
  if (!usernameClean) return NextResponse.json({ error: 'Invalid username' }, { status: 400 });

  const slugClean = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!/^[a-z0-9-]+$/.test(slugClean)) {
    return NextResponse.json({ error: 'Slug must contain only lowercase letters, numbers, and hyphens' }, { status: 400 });
  }

  // Check uniqueness
  const { data: existingUser } = await supabase.from('profiles').select('id').eq('username', usernameClean).maybeSingle();
  if (existingUser) return NextResponse.json({ error: 'Username already taken' }, { status: 400 });

  const { data: existingSlug } = await supabase.from('agent_profiles').select('id').eq('slug', slugClean).maybeSingle();
  if (existingSlug) return NextResponse.json({ error: 'Storefront slug already taken' }, { status: 400 });

  const effFullName = full_name?.trim() || usernameClean;
  const internalEmail = `${usernameClean}@internal.auth`;
  const agentRole = make_super_agent ? 'super_agent' : 'agent';

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: { username: usernameClean, full_name: effFullName },
    app_metadata: { role: agentRole, is_super_agent: !!make_super_agent },
  });

  if (authError || !authData.user) {
    console.error('[manufacturer/agents POST] createUser error:', authError);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }

  const userId = authData.user.id;

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    email: null,
    username: usernameClean,
    full_name: effFullName,
    role: agentRole,
    is_super_agent: !!make_super_agent,
    tier,
    locked_tier_level: tier ? parseInt(tier.replace('tier_', ''), 10) : null,
    fixed_scale_override: true,
    account_type,
    auto_approve_orders: account_type === 'credit',
    commission_pct: commission_pct != null ? Number(commission_pct) : null,
    parent_agent_id: manufacturerId,
    referring_agent_id: manufacturerId,
    created_by_agent_id: manufacturerId,
    created_by_role: 'manufacturer',
    is_active: true,
    must_change_password: true,
    disclaimer_v1_accepted: true,
    disclaimer_accepted_at: new Date().toISOString(),
    onboarding_completed_at: new Date().toISOString(), // Skip onboarding for manufacturer-created agents
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    console.error('[manufacturer/agents POST] profile upsert error:', profileError);
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }

  // QR code
  const storefrontUrl = `${APP_URL}/${slugClean}`;
  let qrCodeData: string | null = null;
  try { qrCodeData = await generateQrDataUrl(storefrontUrl); } catch { /* non-fatal */ }

  const { error: agentError } = await supabase.from('agent_profiles').upsert({
    id: userId,
    slug: slugClean,
    display_name: display_name?.trim() || effFullName,
    qr_code_data: qrCodeData,
    is_active: true,
  }, { onConflict: 'id' });

  if (agentError) {
    console.error('[manufacturer/agents POST] agent_profiles upsert error:', agentError);
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: 'Failed to create storefront' }, { status: 500 });
  }

  // Seed storefront with house prices
  try { await seedStorefrontFromHousePrices(supabase, userId); } catch (e) {
    console.error('[manufacturer/agents POST] seed error (non-fatal):', e);
  }

  // Audit log
  try {
    await supabase.from('admin_audit_log').insert({
      actor_id: manufacturerId,
      action: 'manufacturer_created_agent',
      entity_type: 'profiles',
      entity_id: userId,
      changes: { username: usernameClean, role: agentRole, slug: slugClean },
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({
    success: true,
    userId,
    username: usernameClean,
    slug: slugClean,
    storefrontUrl,
    role: agentRole,
  });
}
