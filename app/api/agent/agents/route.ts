import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { seedStorefrontFromHousePrices } from '@/lib/seed-storefront';

/**
 * GET /api/agent/agents
 *
 * Returns the caller's downline FULL Agents (is_sub_agent = false, role = 'agent').
 * Only super agents should typically have these.
 */
export async function GET(_req: NextRequest) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = createAdminClient();
    const callerId = gate.user.id;

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role, is_super_agent, is_sub_agent')
      .eq('id', callerId)
      .maybeSingle();

    if (!callerProfile || !callerProfile.is_super_agent) {
      return NextResponse.json({ error: 'Forbidden. Only Super Agents can have full Agent Accounts.' }, { status: 403 });
    }

    const { data: downlineAgents, error } = await supabase
      .from('profiles')
      .select(`
        id, full_name, username, email,
        account_type, credit_limit, prepaid_balance,
        created_at, is_active,
        last_sign_in_at, first_sign_in_at,
        is_super_agent,
        agent_profiles(slug, display_name)
      `)
      .eq('parent_agent_id', callerId)
      .eq('is_sub_agent', false)
      .in('role', ['agent', 'super_agent'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GET downline-agents] fetch error:', error);
      return NextResponse.json({ error: 'Failed To Load Agent Accounts.' }, { status: 500 });
    }

    return NextResponse.json({ data: downlineAgents || [] });
  } catch (error) {
    console.error('[GET downline-agents] unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}

import { generateQrDataUrl } from '@/lib/qr';
import { sanitizeUsername } from '@/lib/usernames';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pepnationlab.com';

// Platform rule: the gamification Max Cap can never exceed 40%.
const MAX_CAP_LIMIT = 40;
// The Super-Agent-to-Agent markup (commission_pct on a non-sub-agent profile,
// reused as base_markup by fn_agent_effective_markup) is a separate range from
// the sub-agent recruiter commission / gamification cap above - a Super Agent
// can mark an Agent's cost up well past 40%.
const MARKUP_MAX = 200;

/**
 * POST /api/agent/agents
 *
 * Creates a brand new full Agent Account under the calling Super Agent.
 *
 * Nested Super Agents: when the caller passes `is_super_agent: true`, the new
 * downline account is provisioned as a Super Agent in its own right (role =
 * 'super_agent', is_super_agent = true) while still sitting under the caller
 * in the billing chain (parent_agent_id = callerId). This mirrors the pattern
 * already used by /api/manufacturer/agents (make_super_agent) and the DB's
 * chk_super_agent_role_sync constraint, which requires role = 'super_agent'
 * whenever is_super_agent = true - role can never stay 'agent' here.
 */
export async function POST(req: NextRequest) {
  try {
    const csrf = assertSameOrigin(req);
    if (csrf) return csrf;
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = createAdminClient();
    const callerId = gate.user.id;

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role, is_super_agent, is_sub_agent, default_agent_markup_pct, default_agent_pricing_mode')
      .eq('id', callerId)
      .maybeSingle();

    if (!callerProfile || !callerProfile.is_super_agent) {
      return NextResponse.json({ error: 'Forbidden. Only Super Agents can create Agent Accounts.' }, { status: 403 });
    }

    const callerPricing = callerProfile as { default_agent_markup_pct?: number | null; default_agent_pricing_mode?: string | null };
    const defaultAgentMarkupOverride: number | null | undefined =
      callerPricing.default_agent_pricing_mode === 'gamified'
        ? null
        : callerPricing.default_agent_markup_pct != null
          ? Math.round((Number(callerPricing.default_agent_markup_pct) / 100) * 10000) / 10000
          : undefined;

    const body = await req.json().catch(() => ({}));
    const {
      full_name,
      username,
      password,
      account_type,
      credit_limit,
      prepaid_balance,
      slug,
      display_name,
      commission_pct,
      commission_max_pct,
      velocity_cap,
      custom_commission_scale,
      locale,
      is_super_agent,
    } = body;

    // Only the caller's own explicit choice makes the new downline a Super
    // Agent. Already gated above: only an existing Super Agent (or an admin
    // impersonating one via requireAgent) can reach this handler at all.
    const makeSuperAgent = is_super_agent === true;

    if (!full_name || !username || !password || !account_type || !slug || !display_name) {
      return NextResponse.json({ error: 'Missing Required Fields (Name, Username, Password, Billing, Slug, User Name)' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password Must Be At Least 8 Characters' }, { status: 400 });
    }

    if (account_type === 'credit' && credit_limit !== undefined && credit_limit !== null && credit_limit !== '') {
      const cl = Number(credit_limit);
      if (!Number.isFinite(cl) || cl < 0) {
        return NextResponse.json({ error: 'Credit Limit Must Be Zero Or Greater' }, { status: 400 });
      }
    }
    if (account_type === 'prepaid' && prepaid_balance !== undefined && prepaid_balance !== null && prepaid_balance !== '') {
      const pb = Number(prepaid_balance);
      if (!Number.isFinite(pb) || pb < 0) {
        return NextResponse.json({ error: 'Prepaid Balance Must Be Zero Or Greater' }, { status: 400 });
      }
    }

    let commPct: number | null = null;
    if (commission_pct !== undefined && commission_pct !== null && commission_pct !== '') {
      const rawMarkup = Number(commission_pct);
      if (!Number.isFinite(rawMarkup) || rawMarkup < 0 || rawMarkup > MARKUP_MAX) {
        return NextResponse.json({ error: 'Markup Percent Must Be Between 0 And 200' }, { status: 400 });
      }
      // commission_pct is NUMERIC(5,2) in the DB - round to 2dp.
      commPct = Math.round(rawMarkup * 100) / 100;
    }
    let commMax: number | null = null;
    if (commission_max_pct !== undefined && commission_max_pct !== null && commission_max_pct !== '') {
      commMax = Number(commission_max_pct);
      if (!Number.isFinite(commMax) || commMax < 0 || commMax > MAX_CAP_LIMIT) {
        return NextResponse.json({ error: 'Max Commission Cap Cannot Exceed 40%' }, { status: 400 });
      }
      if (commPct != null && commMax < commPct) {
        return NextResponse.json({ error: 'Max Commission Cap Cannot Be Below The Base Rate' }, { status: 400 });
      }
    }
    let velCap: number | null = null;
    if (velocity_cap !== undefined && velocity_cap !== null && velocity_cap !== '') {
      velCap = Number(velocity_cap);
      if (!Number.isFinite(velCap) || velCap < 0) {
        return NextResponse.json({ error: 'Velocity Cap Must Be Zero Or Greater' }, { status: 400 });
      }
    }

    const usernameClean = sanitizeUsername(username);
    if (!usernameClean) {
      return NextResponse.json({ error: 'Invalid Username' }, { status: 400 });
    }

    const internalEmail = `${usernameClean}@internal.auth`;

    const slugRegex = /^[a-z0-9\-]+$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json({ error: 'Slug Must Contain Lowercase Letters, Numbers, And Hyphens Only' }, { status: 400 });
    }

    // Use .eq() not .ilike() - sanitized usernames may contain underscores (a LIKE wildcard).
    const { data: existingUsername } = await supabase.from('profiles').select('id').eq('username', usernameClean).maybeSingle();
    if (existingUsername) {
      return NextResponse.json({ error: 'This Username Is Already Taken' }, { status: 400 });
    }

    const { data: existingSlug } = await supabase.from('agent_profiles').select('id').eq('slug', slug).maybeSingle();
    if (existingSlug) {
      return NextResponse.json({ error: 'This Storefront Slug Is Already Taken' }, { status: 400 });
    }

    // The new profile's role must match is_super_agent per chk_super_agent_role_sync
    // (a DB check constraint requires role = 'super_agent' whenever is_super_agent =
    // true, and role = 'agent' otherwise) - keep the auth JWT's app_metadata.role in
    // sync too, since several permission gates check role === 'super_agent' there.
    const newProfileRole = makeSuperAgent ? 'super_agent' : 'agent';

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      app_metadata: { role: newProfileRole, is_super_agent: makeSuperAgent }
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred Creating Auth User.' }, { status: 500 });
    }

    const userId = authData.user.id;

    const profileData: Record<string, any> = {
      id: userId,
      email: null,
      username: usernameClean,
      full_name,
      role: newProfileRole,
      is_super_agent: makeSuperAgent,
      is_sub_agent: false,
      parent_agent_id: callerId,
      referring_agent_id: callerId,
      created_by_agent_id: callerId,
      created_by_role: 'super_agent',
      disclaimer_v1_accepted: true,
      disclaimer_accepted_at: new Date().toISOString(),
      is_active: true,
      must_change_password: true,
      provisioned_password: password,
      updated_at: new Date().toISOString(),
      tier: 'tier_3',
      account_type: account_type,
      credit_limit: account_type === 'credit' ? (Number(credit_limit) || null) : null,
      prepaid_balance: account_type === 'prepaid' ? (Number(prepaid_balance) || 0) : 0,
      commission_pct: commPct,
      commission_max_pct: commMax,
      velocity_cap: velCap,
      commission_ladder_config: Array.isArray(custom_commission_scale) ? custom_commission_scale : undefined,
      custom_markup_override: defaultAgentMarkupOverride,
      // New agent's default UI language (English / Simplified / Traditional)
      // chosen on the create form; seeded into their session on first login.
      locale: ['en', 'zh-CN', 'zh-TW'].includes(locale) ? locale : 'en',
    };

    const { error: profileError } = await supabase.from('profiles').upsert(profileData);
    if (profileError) {
      console.error('[agent/agents] profile upsert failed:', profileError);
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'An Unexpected Error Occurred Saving Profile.' }, { status: 500 });
    }

    if (Array.isArray(custom_commission_scale)) {
      await supabase.from('sub_agent_commission_plan').upsert({
        sub_agent_id: userId,
        parent_agent_id: callerId,
        steps: custom_commission_scale,
        updated_at: new Date().toISOString(),
      });
    }

    // QR payload carries utm params so scans are attributable as offline/QR
    // traffic in first-party attribution (UtmCapture ingests and strips them).
    const storefrontUrl = `${APP_URL}/${slug}?utm_source=qr&utm_medium=offline`;
    let qrCodeData: string | null = null;
    try {
      qrCodeData = await generateQrDataUrl(storefrontUrl);
    } catch (qrErr) {
      console.error('QR generation failed:', qrErr);
    }

    const { error: agentError } = await supabase.from('agent_profiles').upsert({
      id: userId,
      slug,
      display_name,
      qr_code_data: qrCodeData,
      is_active: true,
    }, { onConflict: 'id' });

    if (agentError) {
      console.error('[agent/agents] agent_profiles upsert failed:', agentError);
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'An Unexpected Error Occurred Saving Storefront.' }, { status: 500 });
    }

    try {
      // Seed the new storefront with the HOUSE (admin) store's retail prices as
      // the default "set price"; falls back to rookie house-tier pricing for any
      // product the house store has not priced. Agent can change prices later.
      await seedStorefrontFromHousePrices(supabase, userId);
    } catch (provisionErr) {
      console.error('Failed to auto-provision agent products:', provisionErr);
    }

    return NextResponse.json({
      success: true,
      userId,
      username: usernameClean,
      role: makeSuperAgent ? 'Super Agent Account' : 'Agent Account',
      is_super_agent: makeSuperAgent,
    });
  } catch (error) {
    console.error('[POST create-agent] unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
