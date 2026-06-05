export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { generateQrDataUrl } from '@/lib/qr';
import { sanitizeUsername } from '@/lib/usernames';
import { assertSameOrigin } from '@/lib/csrf';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pepnationlab.com';

// GET: List all agents with their profiles and storefront data
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('*, auto_approve_orders, agent_profiles(slug, is_active)')
    .in('role', ['agent', 'super_agent'])
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// POST: Create a brand-new agent or researcher directly (no registration required)
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = createAdminClient();
  const body = await req.json().catch(() => ({}));

  const {
    firstName,
    lastName,
    full_name,
    username,
    password,
    tier,
    account_type,
    credit_limit,
    prepaid_balance,
    slug,
    display_name,
    account_role = 'agent',
    parent_agent_id,
    commission_pct,
    commission_max_pct,
    velocity_cap,
    custom_commission_scale,
    custom_markup_override,
    max_auto_approve_limit,
  } = body;

  const isResearcher = account_role === 'researcher';

  // Platform rule: no commission / gamification level may exceed 40%.
  const MAX_CAP_LIMIT = 40;

  // The admin create form uses a single "Full Name" field, while older callers
  // send firstName/lastName separately. Accept either: derive the missing pieces
  // from full_name so a single name field works. A single-word name is allowed.
  const rawFull = String(full_name ?? '').trim();
  const fnRaw = String(firstName ?? '').trim();
  const lnRaw = String(lastName ?? '').trim();
  let effFirst = fnRaw;
  let effLast = lnRaw;
  if ((!effFirst || !effLast) && rawFull) {
    const parts = rawFull.split(/\s+/).filter(Boolean);
    if (!effFirst) effFirst = parts[0] || '';
    if (!effLast) effLast = parts.slice(1).join(' ');
  }
  const effFullName = rawFull || [effFirst, effLast].filter(Boolean).join(' ').trim();

  if (!effFullName || !username || !password) {
    return NextResponse.json({ error: 'Missing Required Fields' }, { status: 400 });
  }
  if (!isResearcher && (!tier || !account_type || !slug || !display_name)) {
    return NextResponse.json({ error: 'Missing Required Agent Fields (Tier, Billing, Slug, Display Name)' }, { status: 400 });
  }
  if (isResearcher && !parent_agent_id) {
    return NextResponse.json({ error: 'Researcher Accounts Must Be Assigned To An Agent' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password Must Be At Least 8 Characters' }, { status: 400 });
  }

  // Reject negative / non-numeric money values rather than silently coercing
  // them to null/0 later when building the profile row.
  if (!isResearcher && account_type === 'credit' && credit_limit !== undefined && credit_limit !== null && credit_limit !== '') {
    const cl = Number(credit_limit);
    if (!Number.isFinite(cl) || cl < 0) {
      return NextResponse.json({ error: 'Credit Limit Must Be Zero Or Greater' }, { status: 400 });
    }
  }
  if (!isResearcher && account_type === 'prepaid' && prepaid_balance !== undefined && prepaid_balance !== null && prepaid_balance !== '') {
    const pb = Number(prepaid_balance);
    if (!Number.isFinite(pb) || pb < 0) {
      return NextResponse.json({ error: 'Prepaid Balance Must Be Zero Or Greater' }, { status: 400 });
    }
  }

  // Commission / markup structure (agents only). Mirrors POST /api/agent/agents.
  // Fixed markup -> base == cap (flat effective rate). Gamification -> base is
  // the entry rate, cap is the ceiling; the house ladder lifts the rate between
  // them. DB CHECK profiles_commission_pct_range caps commission_pct at 40, so
  // validate here for a clean 400 instead of a constraint-violation 500.
  let commPct: number | null = null;
  let commMax: number | null = null;
  let velCap: number | null = null;
  if (!isResearcher) {
    if (commission_pct !== undefined && commission_pct !== null && commission_pct !== '') {
      commPct = Number(commission_pct);
      if (!Number.isFinite(commPct) || commPct < 0 || commPct > MAX_CAP_LIMIT) {
        return NextResponse.json({ error: 'Commission Rate Cannot Exceed 40%' }, { status: 400 });
      }
    }
    if (commission_max_pct !== undefined && commission_max_pct !== null && commission_max_pct !== '') {
      commMax = Number(commission_max_pct);
      if (!Number.isFinite(commMax) || commMax < 0 || commMax > MAX_CAP_LIMIT) {
        return NextResponse.json({ error: 'Max Commission Cap Cannot Exceed 40%' }, { status: 400 });
      }
      if (commPct != null && commMax < commPct) {
        return NextResponse.json({ error: 'Max Commission Cap Cannot Be Below The Base Rate' }, { status: 400 });
      }
    }
    if (velocity_cap !== undefined && velocity_cap !== null && velocity_cap !== '') {
      velCap = Number(velocity_cap);
      if (!Number.isFinite(velCap) || velCap < 0) {
        return NextResponse.json({ error: 'Velocity Cap Must Be Zero Or Greater' }, { status: 400 });
      }
    }
    // Custom gamification ladder steps: each bonus must stay within 0..40.
    if (Array.isArray(custom_commission_scale)) {
      for (const step of custom_commission_scale) {
        const bonus = Number(step?.bonus_pct);
        const vol = Number(step?.min_volume);
        if (!Number.isFinite(bonus) || bonus < 0 || bonus > MAX_CAP_LIMIT || !Number.isFinite(vol) || vol < 0) {
          return NextResponse.json({ error: 'Gamification Levels Must Be Between 0 And 40% With Non-Negative Volumes' }, { status: 400 });
        }
      }
    }
  }

  const usernameClean = sanitizeUsername(username);
  if (!usernameClean) {
    return NextResponse.json({ error: 'Invalid Username' }, { status: 400 });
  }

  const internalEmail = `${usernameClean}@internal.auth`;

  if (!isResearcher) {
    const slugRegex = /^[a-z0-9\-]+$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json({ error: 'Slug Must Contain Lowercase Letters, Numbers, And Hyphens Only' }, { status: 400 });
    }
  }

  const { data: existingUsername } = await supabase.from('profiles').select('id').ilike('username', usernameClean).maybeSingle();
  if (existingUsername) {
    return NextResponse.json({ error: 'This Username Is Already Taken' }, { status: 400 });
  }

  if (!isResearcher && slug) {
    const { data: existingSlug } = await supabase.from('agent_profiles').select('id').eq('slug', slug).maybeSingle();
    if (existingSlug) {
      return NextResponse.json({ error: 'This Storefront Slug Is Already Taken' }, { status: 400 });
    }
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: internalEmail,
    password,
    // internal.auth accounts have no real inbox to confirm, so mark the email
    // confirmed immediately — otherwise password sign-in is rejected with
    // "email_not_confirmed" and the new agent/super-agent can never log in.
    email_confirm: true,
    user_metadata: {
      username: usernameClean,
      full_name: effFullName
    },
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  const userId = authData.user.id;
  const profileRole = account_role === 'super_agent' ? 'agent' : account_role;
  const profileData: Record<string, unknown> = {
    id: userId,
    email: null,
    username: usernameClean,
    full_name: effFullName,
    first_name: effFirst,
    last_name: effLast,
    role: profileRole,
    disclaimer_v1_accepted: true,
    disclaimer_accepted_at: new Date().toISOString(),
    is_active: true,
    must_change_password: true,
    // Provisioning attribution (2026-06-01)
    created_by_agent_id: gate.userId,
    created_by_role: 'admin',
    updated_at: new Date().toISOString(),
  };

  if (isResearcher) {
    profileData.parent_agent_id = parent_agent_id;
    profileData.referring_agent_id = parent_agent_id;
  } else {
    profileData.tier = tier;
    // Both Agents and Super Agents get their initial tier locked so the dropdown
    // mapping (Tier 1, 2, 3 -> Premium, Pro, Rookie) applies immediately.
    profileData.locked_tier_level = tier ? parseInt(tier.replace('tier_', ''), 10) : null;
    profileData.fixed_scale_override = true;
    profileData.custom_markup_override = custom_markup_override !== undefined ? custom_markup_override : null;
    profileData.account_type = account_type;
    profileData.auto_approve_orders = account_type === 'credit';
    profileData.max_auto_approve_limit = account_type === 'credit' && max_auto_approve_limit ? Number(max_auto_approve_limit) : null;
    profileData.credit_limit = account_type === 'credit' ? (Number(credit_limit) || null) : null;
    profileData.prepaid_balance = account_type === 'prepaid' ? (Number(prepaid_balance) || 0) : 0;
    profileData.is_super_agent = account_role === 'super_agent';
    // Persist the commission/markup the admin chose. fn_agent_effective_markup
    // reads commission_pct (base) and commission_max_pct (floor); a NULL base
    // means 0 markup, so without this the admin's Fixed/Gamification choice was
    // silently dropped. A custom per-step ladder, if supplied, is also written to
    // sub_agent_commission_plan below so the order engine applies it.
    profileData.commission_pct = commPct;
    profileData.commission_max_pct = commMax;
    profileData.velocity_cap = velCap;
    profileData.commission_ladder_config = Array.isArray(custom_commission_scale) ? custom_commission_scale : undefined;
  }

  const { error: profileError } = await supabase.from('profiles').upsert(profileData);
  if (profileError) {
    console.error('[admin/agents] profile upsert failed:', profileError);
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  if (!isResearcher) {
    const storefrontUrl = `${APP_URL}/${slug}`;
    let qrCodeData: string | null = null;
    try {
      qrCodeData = await generateQrDataUrl(storefrontUrl);
    } catch (qrErr) {
      console.error('QR generation failed:', qrErr);
      qrCodeData = null;
    }

    // A DB trigger (provision_agent_storefront) auto-creates an agent_profiles
    // row the moment the profile role becomes 'agent' (during the upsert above),
    // using a username-derived slug. So a row with this id may already exist.
    // Upsert (not insert) so the admin's chosen slug + display name win and we
    // never hit a primary-key collision.
    const { error: agentError } = await supabase.from('agent_profiles').upsert({
      id: userId,
      slug,
      display_name,
      qr_code_data: qrCodeData,
      is_active: true,
    }, { onConflict: 'id' });

    if (agentError) {
      console.error('[admin/agents] agent_profiles upsert failed:', agentError);
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }

    // Persist a custom gamification ladder if the admin built one. The order-time
    // engine (fn_agent_effective_markup) reads steps from sub_agent_commission_plan
    // by sub_agent_id. Top-level admin-created agents have no super-agent parent,
    // so parent_agent_id is null (allowed since 20260602000000). Non-fatal: the
    // agent already has base + cap, and the house default ladder fills the curve.
    if (Array.isArray(custom_commission_scale)) {
      const { error: planError } = await supabase.from('sub_agent_commission_plan').upsert({
        sub_agent_id: userId,
        parent_agent_id: parent_agent_id ?? null,
        steps: custom_commission_scale,
        updated_at: new Date().toISOString(),
      });
      if (planError) console.error('[admin/agents] commission plan upsert failed (non-fatal):', planError);
    }

    // Seed the agent's product catalog so the storefront isn't empty. Mirrors
    // POST /api/agent/agents. Non-fatal: the account exists regardless.
    try {
      const { data: tier1 } = await supabase.from('pricing_tiers').select('multiplier').eq('tier_name', 'tier_1').single();
      const { data: products } = await supabase.from('products').select('id, base_cost').eq('is_active', true);
      if (tier1 && products && products.length > 0) {
        const agentMultiplier = (Number(tier1.multiplier) || 1.3) * 1.2;
        const agentProductsToInsert = products.map((p) => ({
          agent_id: userId,
          product_id: p.id,
          retail_price: Math.round((Number(p.base_cost) * agentMultiplier) * 100) / 100,
          margin_percent: 50,
          is_visible: true,
          sort_order: 0,
        }));
        await supabase.from('agent_products').insert(agentProductsToInsert);
      }
    } catch (provisionErr) {
      console.error('[admin/agents] agent product provisioning failed (non-fatal):', provisionErr);
    }
  }

  const roleLabel = isResearcher ? 'Researcher' : account_role === 'super_agent' ? 'Super Agent' : 'Agent';
  return NextResponse.json({ success: true, userId, username: usernameClean, role: roleLabel });
}
