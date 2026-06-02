import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

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

    const supabase = await createServiceClient();
    const callerId = gate.user.id;

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role, is_super_agent, is_sub_agent')
      .eq('id', callerId)
      .single();

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
        agent_profiles(slug, display_name)
      `)
      .eq('parent_agent_id', callerId)
      .eq('is_sub_agent', false)
      .eq('role', 'agent')
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

/**
 * POST /api/agent/agents
 *
 * Creates a brand new full Agent Account under the calling Super Agent.
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const callerId = gate.user.id;

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role, is_super_agent, is_sub_agent')
      .eq('id', callerId)
      .single();

    if (!callerProfile || !callerProfile.is_super_agent) {
      return NextResponse.json({ error: 'Forbidden. Only Super Agents can create Agent Accounts.' }, { status: 403 });
    }

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
    } = body;

    if (!full_name || !username || !password || !account_type || !slug || !display_name) {
      return NextResponse.json({ error: 'Missing Required Fields (Name, Username, Password, Billing, Slug, Display Name)' }, { status: 400 });
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

    // Commission structure (optional). Fixed Percentage = cap equal to base
    // (forces a flat effective rate); Gamification Scale = cap above the base
    // plus an optional velocity cap, so the milestone ladder lifts the rate.
    let commPct: number | null = null;
    if (commission_pct !== undefined && commission_pct !== null && commission_pct !== '') {
      commPct = Number(commission_pct);
      if (!Number.isFinite(commPct) || commPct < 0 || commPct > 100) {
        return NextResponse.json({ error: 'Commission Rate Must Be Between 0 And 100' }, { status: 400 });
      }
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

    const { data: existingUsername } = await supabase.from('profiles').select('id').ilike('username', usernameClean).maybeSingle();
    if (existingUsername) {
      return NextResponse.json({ error: 'This Username Is Already Taken' }, { status: 400 });
    }

    const { data: existingSlug } = await supabase.from('agent_profiles').select('id').eq('slug', slug).maybeSingle();
    if (existingSlug) {
      return NextResponse.json({ error: 'This Storefront Slug Is Already Taken' }, { status: 400 });
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'An unexpected error occurred creating auth user.' }, { status: 500 });
    }

    const userId = authData.user.id;

    // The user gets 'agent' role, and is_sub_agent = false, parent_agent_id = callerId
    const profileData: Record<string, any> = {
      id: userId,
      // Must be NULL, not '' — the profiles_email_not_blank CHECK rejects a blank
      // string (internal.auth accounts carry no real email).
      email: null,
      username: usernameClean,
      full_name,
      role: 'agent',
      is_sub_agent: false,
      parent_agent_id: callerId,
      referring_agent_id: callerId,
      // Provisioning attribution (2026-06-01): track the super_agent as the creator.
      created_by_agent_id: callerId,
      created_by_role: 'super_agent',
      disclaimer_v1_accepted: true,
      disclaimer_accepted_at: new Date().toISOString(),
      is_active: true,
      updated_at: new Date().toISOString(),
      // profiles.tier is the agent_tier enum (tier_1|tier_2|tier_3). It must be a
      // valid enum label or the whole upsert fails. Full agents under a super
      // agent are priced via super_agent_pricing, not this tier, so default to
      // tier_3 (entry) purely to satisfy the column.
      tier: 'tier_3',
      account_type: account_type,
      credit_limit: account_type === 'credit' ? (Number(credit_limit) || null) : null,
      prepaid_balance: account_type === 'prepaid' ? (Number(prepaid_balance) || 0) : 0,
      // Commission structure (fixed vs gamification). Null when not supplied.
      commission_pct: commPct,
      commission_max_pct: commMax,
      velocity_cap: velCap,
      commission_ladder_config: Array.isArray(custom_commission_scale) ? custom_commission_scale : undefined,
    };

    const { error: profileError } = await supabase.from('profiles').upsert(profileData);
    if (profileError) {
      console.error('[agent/agents] profile upsert failed:', profileError);
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'An unexpected error occurred saving profile.' }, { status: 500 });
    }

    if (Array.isArray(custom_commission_scale)) {
      await supabase.from('sub_agent_commission_plan').upsert({
        sub_agent_id: userId,
        parent_agent_id: callerId,
        steps: custom_commission_scale,
        updated_at: new Date().toISOString(),
      });
    }

    const storefrontUrl = `${APP_URL}/${slug}`;
    let qrCodeData: string | null = null;
    try {
      qrCodeData = await generateQrDataUrl(storefrontUrl);
    } catch (qrErr) {
      console.error('QR generation failed:', qrErr);
    }

    // A DB trigger (provision_agent_storefront) auto-creates an agent_profiles
    // row the moment the profile role becomes 'agent' (during the upsert above),
    // using a username-derived slug. So a row with this id already exists here.
    // Upsert (not insert) so the chosen slug + display name win and we never hit
    // a primary-key collision.
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
      return NextResponse.json({ error: 'An unexpected error occurred saving storefront.' }, { status: 500 });
    }

    // Auto-provision Agent Products with 20% markup on Tier 1
    try {
      const { data: tier1 } = await supabase.from('pricing_tiers').select('multiplier').eq('tier_name', 'tier_1').single();
      const { data: products } = await supabase.from('products').select('id, base_cost').eq('is_active', true);
      
      if (tier1 && products && products.length > 0) {
        const agentMultiplier = (Number(tier1.multiplier) || 1.3) * 1.2;
        const agentProductsToInsert = products.map((p) => {
          const retailPrice = Math.round((Number(p.base_cost) * agentMultiplier) * 100) / 100;
          return {
            agent_id: userId,
            product_id: p.id,
            retail_price: retailPrice,
            margin_percent: 50,
            is_visible: true,
            sort_order: 0
          };
        });
        await supabase.from('agent_products').insert(agentProductsToInsert);
      }
    } catch (provisionErr) {
      console.error('Failed to auto-provision agent products:', provisionErr);
      // Non-fatal, agent account still created
    }

    return NextResponse.json({ success: true, userId, username: usernameClean, role: 'Agent Account' });
  } catch (error) {
    console.error('[POST create-agent] unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
