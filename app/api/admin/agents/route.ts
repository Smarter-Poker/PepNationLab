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

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('*, auto_approve_orders, provisioned_password, agent_profiles(slug, is_active)')
      .in('role', ['agent', 'super_agent', 'researcher'])
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[admin/agents] GET error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}

// POST: Create a brand-new agent or researcher directly (no registration required)
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
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
    if (username.length > 40) return NextResponse.json({ error: 'Username Too Long (Max 40 Characters)' }, { status: 400 });
    if (password.length > 128) return NextResponse.json({ error: 'Password Too Long (Max 128 Characters)' }, { status: 400 });
    if (effFullName.length > 160) return NextResponse.json({ error: 'Full Name Too Long (Max 160 Characters)' }, { status: 400 });
    if (slug && slug.length > 80) return NextResponse.json({ error: 'Slug Too Long (Max 80 Characters)' }, { status: 400 });
    if (display_name && display_name.length > 120) return NextResponse.json({ error: 'Display Name Too Long (Max 120 Characters)' }, { status: 400 });
    if (!isResearcher && (!tier || !account_type || !slug || !display_name)) {
      return NextResponse.json({ error: 'Missing Required Agent Fields (Tier, Billing, Slug, User Name)' }, { status: 400 });
    }
    if (isResearcher && !parent_agent_id) {
      return NextResponse.json({ error: 'Researcher Accounts Must Be Assigned To An Agent' }, { status: 400 });
    }
    const resolvedParentAgentId = isResearcher
      ? (parent_agent_id === '__ADMIN__' ? gate.userId : parent_agent_id)
      : parent_agent_id;
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password Must Be At Least 8 Characters' }, { status: 400 });
    }

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

    const { data: existingUsername } = await supabase.from('profiles').select('id').eq('username', usernameClean).maybeSingle();
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
      email_confirm: true,
      user_metadata: {
        username: usernameClean,
        full_name: effFullName
      },
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
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
      created_by_agent_id: gate.userId,
      created_by_role: 'admin',
      updated_at: new Date().toISOString(),
    };

    if (isResearcher) {
      profileData.parent_agent_id = resolvedParentAgentId;
      profileData.referring_agent_id = resolvedParentAgentId;
    } else {
      profileData.tier = tier;
      profileData.locked_tier_level = tier ? parseInt(tier.replace('tier_', ''), 10) : null;
      profileData.fixed_scale_override = true;
      profileData.custom_markup_override = custom_markup_override !== undefined ? custom_markup_override : null;
      profileData.account_type = account_type;
      profileData.auto_approve_orders = account_type === 'credit';
      profileData.max_auto_approve_limit = account_type === 'credit' && max_auto_approve_limit ? Number(max_auto_approve_limit) : null;
      profileData.credit_limit = account_type === 'credit' ? (Number(credit_limit) || null) : null;
      profileData.prepaid_balance = account_type === 'prepaid' ? (Number(prepaid_balance) || 0) : 0;
      profileData.is_super_agent = account_role === 'super_agent';
      profileData.commission_pct = commPct;
      profileData.commission_max_pct = commMax;
      profileData.velocity_cap = velCap;
      profileData.commission_ladder_config = Array.isArray(custom_commission_scale) ? custom_commission_scale : undefined;
    }

    profileData.provisioned_password = password;

    const { error: profileError } = await supabase.from('profiles').upsert(profileData);
    if (profileError) {
      console.error('[admin/agents] profile upsert failed:', profileError);
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
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
        return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
      }

      if (Array.isArray(custom_commission_scale)) {
        const { error: planError } = await supabase.from('sub_agent_commission_plan').upsert({
          sub_agent_id: userId,
          parent_agent_id: parent_agent_id ?? null,
          steps: custom_commission_scale,
          updated_at: new Date().toISOString(),
        });
        if (planError) console.error('[admin/agents] commission plan upsert failed (non-fatal):', planError);
      }

      try {
        const { data: rookieTier } = await supabase.from('house_tiers').select('markup').eq('level', 3).maybeSingle();
        const rookieMultiplier = rookieTier?.markup != null ? 1 + Number(rookieTier.markup) : 3.50;
        if (!rookieMultiplier) {
          console.warn('[admin/agents] house_tiers rookie level not found; skipping catalog seed');
        } else {
          const { data: products } = await supabase.from('products').select('id, base_cost').eq('is_active', true);
          if (products && products.length > 0) {
            const agentProductsToInsert = products.map((p) => ({
              agent_id: userId,
              product_id: p.id,
              retail_price: Math.round((Number(p.base_cost) * rookieMultiplier) * 100) / 100,
              margin_percent: 50,
              is_visible: true,
              sort_order: 0,
            }));
            await supabase.from('agent_products').insert(agentProductsToInsert);
          }
        }
      } catch (provisionErr) {
        console.error('[admin/agents] agent product provisioning failed (non-fatal):', provisionErr);
      }
    }

    const roleLabel = isResearcher ? 'Researcher' : account_role === 'super_agent' ? 'Super Agent' : 'Agent';
    return NextResponse.json({ success: true, userId, username: usernameClean, role: roleLabel });
  } catch (err) {
    console.error('[admin/agents] POST error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}
