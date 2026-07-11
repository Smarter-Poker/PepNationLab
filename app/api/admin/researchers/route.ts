export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { unwrapMaybe } from '@/lib/supabase/unwrap';
import { assertSameOrigin } from '@/lib/csrf';

// GET: List all profiles with optional roles and search query
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createAdminClient();
    const searchParams = req.nextUrl.searchParams;
    const role = searchParams.get('role');
    const rawQuery = searchParams.get('query');
    const rawLimit = parseInt(searchParams.get('limit') ?? '100', 10);
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = Math.min(isNaN(rawLimit) || rawLimit < 1 ? 100 : rawLimit, 500);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const offset = (page - 1) * limit;

    let dbQuery = supabase
      .from('profiles')
      .select('*, agent_profiles(slug, display_name, is_active)', { count: 'exact' });

    if (role) {
      dbQuery = dbQuery.eq('role', role);
    }

    if (rawQuery) {
      // P0 1.23: PostgREST .or() injection - sanitize syntax-significant chars.
      const sanitized = rawQuery.replace(/[%,():\"'\\_[\]]/g, '').trim().slice(0, 60);
      if (sanitized) {
        dbQuery = dbQuery.or(
          `full_name.ilike.%${sanitized}%,username.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`
        );
      }
    }

    dbQuery = dbQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    const { data, error, count } = await dbQuery;
    if (error) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });

    // Enrich each row with the display name / slug of its CURRENT owner
    // (referring_agent_id). This powers the "Owner" label and the house-vs-agent
    // filter on the admin Researchers tab so reassigned researchers can be
    // filtered out of the admin's house list. Done as one extra batched query
    // to avoid a fragile self-referential PostgREST embed.
    const rows = data ?? [];
    const ownerIds = Array.from(
      new Set(
        rows
          .map((r: { referring_agent_id?: string | null }) => r.referring_agent_id)
          .filter((v): v is string => !!v)
      )
    );
    const ownerMap: Record<string, { name: string | null; slug: string | null; role: string | null }> = {};
    if (ownerIds.length > 0) {
      const { data: owners } = await supabase
        .from('profiles')
        .select('id, full_name, username, role, agent_profiles(slug, display_name)')
        .in('id', ownerIds);
      for (const o of owners ?? []) {
        const ap = Array.isArray((o as any).agent_profiles)
          ? (o as any).agent_profiles[0]
          : (o as any).agent_profiles;
        ownerMap[(o as any).id] = {
          name: ap?.display_name ?? (o as any).full_name ?? (o as any).username ?? null,
          slug: ap?.slug ?? null,
          role: (o as any).role ?? null,
        };
      }
    }
    const enriched = rows.map((r: any) => {
      const owner = r.referring_agent_id ? ownerMap[r.referring_agent_id] : undefined;
      return {
        ...r,
        referring_agent_name: owner?.name ?? null,
        referring_agent_slug: owner?.slug ?? null,
        referring_agent_role: owner?.role ?? null,
      };
    });

    return NextResponse.json({ data: enriched, total: count ?? 0, page, limit });
  } catch (err) {
    console.error('[admin/researchers] GET error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createAdminClient();
    const body = await req.json().catch(() => ({}));

    const { id, action, role, tier, account_type, credit_limit, is_active, slug, display_name, balance_delta, custom_markup_override, assign_to_agent_id } = body;
    if (!id) return NextResponse.json({ error: 'Missing User ID' }, { status: 400 });

    // Security: role must be one of the allowed non-admin values.
    const ALLOWED_ROLES = new Set(['researcher', 'agent', 'super_agent']);
    if (action !== 'toggle_active' && action !== 'adjust_balance' && action !== 'assign_researcher') {
      if (!role || !ALLOWED_ROLES.has(role)) {
        return NextResponse.json(
          { error: 'Invalid Role. Must Be researcher, agent, Or super_agent.' },
          { status: 400 }
        );
      }
    }

    if (action === 'toggle_active') {
      if (is_active === undefined) return NextResponse.json({ error: 'Missing is_active Value' }, { status: 400 });
      const { error: toggleError } = await supabase.from('profiles').update({ is_active, updated_at: new Date().toISOString() }).eq('id', id);
      if (toggleError) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
      await supabase.from('agent_profiles').update({ is_active: !!is_active }).eq('id', id);

      await supabase.from('admin_audit_log').insert({
        actor_id: gate.userId,
        action: 'account_active_toggled',
        entity_type: 'profile',
        entity_id: id,
        changes: { is_active: !!is_active },
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'adjust_balance') {
      const delta = Number(balance_delta);
      if (isNaN(delta) || !isFinite(delta)) return NextResponse.json({ error: 'Invalid Balance Amount' }, { status: 400 });
      if (Math.abs(delta) > 10000) return NextResponse.json({ error: 'Balance Adjustment Exceeds $10,000 Limit' }, { status: 400 });

      const currentProfile = await unwrapMaybe('researcher.balance_check', supabase.from('profiles').select('prepaid_balance, full_name').eq('id', id).maybeSingle());
      if (!currentProfile) return NextResponse.json({ error: 'User Not Found' }, { status: 404 });

      const balanceBefore = Number(currentProfile?.prepaid_balance ?? 0);
      const newBalance = Math.max(0, balanceBefore + delta);

      const { error: balanceError } = await supabase.from('profiles').update({ prepaid_balance: newBalance, updated_at: new Date().toISOString() }).eq('id', id);
      if (balanceError) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });

      const txType = delta >= 0 ? 'credit' : 'debit';
      await supabase.from('balance_transactions').insert({
        agent_id: id, type: txType, amount: Math.abs(delta),
        balance_before: balanceBefore, balance_after: newBalance,
        description: delta >= 0 ? `Admin Balance Credit: +$${Math.abs(delta).toFixed(2)}` : `Admin Balance Deduction: -$${Math.abs(delta).toFixed(2)}`,
        reference_type: 'admin_adjustment',
      });

      await supabase.from('admin_audit_log').insert({
        actor_id: gate.userId,
        action: 'balance_adjusted',
        entity_type: 'profile',
        entity_id: id,
        changes: { delta, balance_before: balanceBefore, balance_after: newBalance },
      });

      return NextResponse.json({ success: true, new_balance: newBalance });
    }

    // Reassign a researcher to a different agent / super agent (or back to the
    // house). The canonical ownership field is referring_agent_id -- an agent's
    // "My Researchers" view filters on it (.eq('referring_agent_id', callerId)).
    // We mirror the admin-create-researcher path by setting parent_agent_id too,
    // and clear referring_sub_agent_id so a sub-agent-created researcher moves
    // cleanly to the new owner. Passing '__HOUSE__' returns them to the house
    // store (researchstore) so they reappear under the admin's list.
    if (action === 'assign_researcher') {
      if (!assign_to_agent_id || typeof assign_to_agent_id !== 'string') {
        return NextResponse.json({ error: 'Please Select An Agent To Assign This Researcher To' }, { status: 400 });
      }

      // The target must be an existing researcher account (not an agent/admin).
      const target = await unwrapMaybe(
        'researcher.target_check',
        supabase
          .from('profiles')
          .select('id, role')
          .eq('id', id)
          .maybeSingle()
      );
      if (!target) return NextResponse.json({ error: 'Researcher Not Found' }, { status: 404 });
      if (target.role !== 'researcher') {
        return NextResponse.json({ error: 'Only Researcher Accounts Can Be Reassigned' }, { status: 400 });
      }

      let newReferringAgentId: string | null = null;
      let newParentAgentId: string | null = null;

      if (assign_to_agent_id === '__HOUSE__') {
        // Resolve the house storefront (researchstore) owner id.
        const { data: house } = await supabase
          .from('agent_profiles')
          .select('id')
          .eq('slug', 'researchstore')
          .maybeSingle();
        // Fall back to the acting admin if the house store cannot be resolved,
        // so the researcher is never left orphaned.
        newReferringAgentId = house?.id ?? gate.userId;
        newParentAgentId = null;
      } else {
        // Validate the target owner is an active agent or super agent.
        const owner = await unwrapMaybe(
          'researcher.owner_check',
          supabase
            .from('profiles')
            .select('id, role, is_active')
            .eq('id', assign_to_agent_id)
            .maybeSingle()
        );
        if (!owner || (owner.role !== 'agent' && owner.role !== 'super_agent')) {
          return NextResponse.json({ error: 'Selected Owner Must Be An Agent Or Super Agent' }, { status: 400 });
        }
        if (owner.is_active === false) {
          return NextResponse.json({ error: 'Cannot Assign To A Deactivated Agent' }, { status: 400 });
        }
        newReferringAgentId = owner.id;
        newParentAgentId = owner.id;
      }

      // Ownership changes go through the sanctioned SECURITY DEFINER RPC.
      // A direct profiles UPDATE is blocked by the
      // enforce_researcher_agent_binding trigger, which makes
      // referring_agent_id immutable to protect agents' researcher lists
      // from being poached by any other write path. The RPC (service_role
      // execute only) sets a transaction-local flag that trigger honors.
      const { error: assignErr } = await supabase.rpc('admin_reassign_researcher', {
        p_researcher_id: id,
        p_new_referring_agent_id: newReferringAgentId,
        p_new_parent_agent_id: newParentAgentId,
      });
      if (assignErr) {
        console.error('[admin/researchers] assign_researcher rpc failed:', assignErr.message);
        return NextResponse.json({ error: `Reassignment Failed: ${assignErr.message}` }, { status: 500 });
      }

      await supabase.from('admin_audit_log').insert({
        actor_id: gate.userId,
        action: 'researcher_reassigned',
        entity_type: 'profile',
        entity_id: id,
        changes: { referring_agent_id: newReferringAgentId, assigned_to: assign_to_agent_id },
      });

      return NextResponse.json({ success: true, referring_agent_id: newReferringAgentId });
    }

    let locked_tier_level = null;
    if (tier) {
      locked_tier_level = parseInt(tier.replace('tier_', ''), 10);
    }

    const isSuperPromotion = role === 'super_agent';
    const isAgentRole = role === 'agent' || role === 'super_agent';
    const canonicalRole = isSuperPromotion ? 'agent' : role;

    // Validate agent-specific fields BEFORE updating the profile to avoid
    // leaving the user in a broken state (role=agent but no agent_profiles row)
    // if validation fails.
    if (isAgentRole) {
      if (!slug || !display_name) return NextResponse.json({ error: 'Slug And User Name Are Required For Agents' }, { status: 400 });
      if (typeof display_name !== 'string' || display_name.length > 100) return NextResponse.json({ error: 'User Name Length Must Be 100 Characters Or Less' }, { status: 400 });
      const slugRegex = /^[a-z0-9\-]+$/;
      if (!slugRegex.test(slug)) return NextResponse.json({ error: 'Slug Must Contain Lowercase Letters, Numbers, And Hyphens Only' }, { status: 400 });
      if (slug.length < 2 || slug.length > 50) return NextResponse.json({ error: 'Slug Length Must Be Between 2 And 50 Characters' }, { status: 400 });

      const existingSlug = await unwrapMaybe('researcher.slug_check', supabase.from('agent_profiles').select('id').eq('slug', slug).neq('id', id).maybeSingle());
      if (existingSlug) return NextResponse.json({ error: 'This Agent Storefront Slug Is Already Taken' }, { status: 400 });
    }

    const profileUpdates: Record<string, unknown> = {
      role: canonicalRole,
      is_super_agent: isSuperPromotion,
      tier: role === 'researcher' ? null : tier,
      locked_tier_level: role === 'researcher' ? null : locked_tier_level,
      fixed_scale_override: role === 'researcher' ? false : true,
      account_type: role === 'researcher' ? null : account_type,
      credit_limit: role === 'researcher' || account_type === 'prepaid' ? null : (credit_limit ? Number(credit_limit) : null),
      custom_markup_override: role === 'researcher' ? null : (custom_markup_override !== undefined ? custom_markup_override : null),
      is_active: is_active !== undefined ? is_active : true,
      updated_at: new Date().toISOString(),
    };

    if (isAgentRole) {
      profileUpdates.parent_agent_id = null;
      profileUpdates.referring_agent_id = null;
      profileUpdates.referring_sub_agent_id = null;
      profileUpdates.is_sub_agent = false;
    }

    const { error: profileError } = await supabase.from('profiles').update(profileUpdates).eq('id', id);
    if (profileError) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });

    await supabase.from('admin_audit_log').insert({
      actor_id: gate.userId,
      action: 'profile_role_updated',
      entity_type: 'profile',
      entity_id: id,
      changes: { role, tier, account_type, credit_limit },
    });

    if (isAgentRole) {
      const agentProfileData = {
        id, slug, display_name,
        is_active: is_active !== undefined ? is_active : true,
        updated_at: new Date().toISOString(),
      };
      const { error: agentError } = await supabase.from('agent_profiles').upsert(agentProfileData);
      if (agentError) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    } else {
      await supabase.from('agent_profiles').update({ is_active: false }).eq('id', id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/researchers] POST error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}
