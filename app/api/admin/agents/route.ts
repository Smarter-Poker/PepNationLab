export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { generateStorefrontQr } from '@/lib/qr-storefront';
import { sanitizeUsername } from '@/lib/usernames';
import { assertSameOrigin } from '@/lib/csrf';
import { seedStorefrontFromHousePrices } from '@/lib/seed-storefront';
import { validateStoreSlug } from '@/lib/store-slug';

// GET: List all agents with their profiles and storefront data
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createAdminClient();

    // Explicit column list instead of '*': this endpoint returns up to 2000
    // profile rows, and the wildcard was shipping wide/unused columns
    // (cart_state JSONB, commission config, acquisition metadata, ...) to the
    // browser on every load. The list below covers every field read by the
    // consumers of this response (components/AdminAgents.tsx,
    // app/admin/agent-notes/page.tsx, app/admin/coupons/page.tsx).
    // provisioned_password stays intentionally - the admin agents screen has a
    // reveal-password feature that renders it.
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, created_at, full_name, first_name, last_name, username, email, phone, role, tier, ' +
        'account_type, credit_limit, prepaid_balance, is_active, is_super_agent, is_sub_agent, is_manufacturer, is_admin_account, ' +
        'parent_agent_id, auto_approve_orders, provisioned_password, last_sign_in_at, ' +
        'agent_profiles(slug, is_active)'
      )
      .in('role', ['agent', 'super_agent'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    }

    // Strip the plaintext provisioned_password from the list payload; expose
    // only a boolean flag. The password itself is fetched on demand via the
    // audited /api/admin/agents/reveal-password endpoint.
    const rows = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => {
      const { provisioned_password, ...rest } = r;
      return { ...rest, has_provisioned_password: provisioned_password != null };
    });
    return NextResponse.json({ data: rows });
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
      locale,
    } = body;

    // Allowlist the caller-supplied account_role. Without this, account_role is
    // written straight into profiles.role below (profileRole), so a crafted
    // request with account_role:'admin' (or 'shipping') would mint a new
    // privileged account - a persistence backdoor that survives the original
    // admin's password rotation. This route may only provision non-privileged
    // account types; new admins/shipping users are created out of band.
    const ALLOWED_ACCOUNT_ROLES = new Set(['agent', 'super_agent', 'researcher', 'manufacturer', 'admin_account']);
    if (!ALLOWED_ACCOUNT_ROLES.has(account_role)) {
      return NextResponse.json({ error: 'Invalid Account Role' }, { status: 400 });
    }

    const isResearcher = account_role === 'researcher';
    const isManufacturer = account_role === 'manufacturer';
    const isAdminAccount = account_role === 'admin_account';

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
    if (effFullName.length > 160) return NextResponse.json({ error: 'Full Name Too Long (Max 160 Characters)' }, { status: 400 });
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
    if (password.length !== 8) {
      return NextResponse.json({ error: 'Password Must Be Exactly 8 Characters.' }, { status: 400 });
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

    // Storefront slug shape. This MUST agree with the edge middleware
    // (proxy.ts), which is what actually routes /<slug>, and with the
    // agent_profiles_slug_shape CHECK + agent_profiles_slug_not_reserved
    // trigger in the database. The old check here was /^[a-z0-9\-]+$/ with a
    // separate 80-character cap, which accepted `-x`, `a`, an 80-char slug and
    // reserved segments like `admin`/`wallet`/`checkout` -- every one of which
    // creates an agent whose QR code points somewhere unroutable, with no
    // error raised until a customer scans it. lib/store-slug.ts is the single
    // source of truth.
    if (!isResearcher) {
      const slugError = validateStoreSlug(slug);
      if (slugError) {
        return NextResponse.json({ error: slugError }, { status: 400 });
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
      app_metadata: {
        role: account_role === 'super_agent' ? 'super_agent' : account_role
      }
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    }

    const userId = authData.user.id;
    // Map account_role to the DB profile role:
    // - manufacturer + admin_account both land as 'super_agent' in profiles.role
    //   but carry extra boolean flags to distinguish them
    const profileRole = (() => {
      if (account_role === 'super_agent' || account_role === 'manufacturer' || account_role === 'admin_account') return 'super_agent';
      if (account_role === 'researcher') return 'researcher';
      return 'agent';
    })();
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
      // New account's default UI language (English / Simplified / Traditional),
      // chosen on the creation form. Seeded into their session on first login.
      locale: ['en', 'zh-CN', 'zh-TW'].includes(locale) ? locale : 'en',
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
      profileData.is_super_agent = account_role === 'super_agent' || account_role === 'admin_account' || account_role === 'manufacturer';
      profileData.is_manufacturer = account_role === 'manufacturer';
      // Admin Account flag — used to gate the manufacturer-style dashboard & network features
      // without granting full platform admin access
      if (account_role === 'admin_account') profileData.is_admin_account = true;
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
      // Carries ?ref= so a scan mints a HARD first-scan-wins referral lock,
      // and renders black-on-white so phone cameras can actually decode it.
      // See lib/qr-storefront.ts.
      const qrCodeData: string | null = await generateStorefrontQr(slug, usernameClean);

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
        // Seed the new storefront with the HOUSE (admin) store's retail prices as
        // the default "set price"; falls back to rookie house-tier pricing for any
        // product the house store has not priced. Agent can change prices later.
        await seedStorefrontFromHousePrices(supabase, userId);
      } catch (provisionErr) {
        console.error('[admin/agents] agent product provisioning failed (non-fatal):', provisionErr);
      }
    }

    const roleLabel = isResearcher ? 'Researcher' : isManufacturer ? 'Manufacturer' : isAdminAccount ? 'Admin Account' : account_role === 'super_agent' ? 'Super Agent' : 'Agent';
    return NextResponse.json({ success: true, userId, username: usernameClean, role: roleLabel });
  } catch (err) {
    console.error('[admin/agents] POST error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}
