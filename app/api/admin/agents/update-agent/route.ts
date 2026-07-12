import { z } from "zod";
import { NextRequest, NextResponse } from 'next/server';
import { safeError } from '@/lib/api-error';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { writeAuditLog } from '@/lib/admin-audit';


const PATCHBodySchema = z.any();

export async function PATCH(request: NextRequest) {
  try {
    // CSRF: state-changing admin route must be same-origin (platform rule).
    const csrf = assertSameOrigin(request);
    if (csrf) return csrf;

    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    const supabase = createAdminClient();

    
    
  const __rawBody = await request.json().catch(() => ({}));
  const __bodyParse = PATCHBodySchema.safeParse(__rawBody);
  if (!__bodyParse.success) {
    return NextResponse.json({ error: "Invalid Request Body", details: __bodyParse.error.issues }, { status: 400 });
  }
  const body = __bodyParse.data;


    const {
      id,
      full_name,
      is_active,
      account_type,
      credit_limit,
      prepaid_balance,
      max_auto_approve_limit
    } = body;

    if (!id) return NextResponse.json({ error: 'Missing Agent ID' }, { status: 400 });

    // Admin-target guard: every sibling route (update-password, update-contact,
    // update-tier, super-upgrade) refuses to operate on an admin account. This
    // route did not, so one admin could deactivate a co-admin (or themselves)
    // and change any admin's money fields by id. Mirror the guard here.
    const { data: target } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', id)
      .maybeSingle();
    if (!target) return NextResponse.json({ error: 'Profile Not Found' }, { status: 404 });
    if (target.role === 'admin') {
      return NextResponse.json(
        { error: 'Cannot Modify An Admin Account Via This Route' },
        { status: 403 },
      );
    }

    const updates: any = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (is_active !== undefined) updates.is_active = is_active;
    if (account_type !== undefined) {
      updates.account_type = account_type;
      updates.auto_approve_orders = account_type === 'credit';
    }
    
    // Convert to number or null, ensuring safe defaults. Money fields are
    // clamped to >= 0 so a stray negative can never persist a bad balance.
    const nonNeg = (v: number) => (Number.isFinite(v) ? Math.max(0, v) : 0);
    if (credit_limit !== undefined) updates.credit_limit = credit_limit === '' ? null : nonNeg(Number(credit_limit));
    if (prepaid_balance !== undefined) updates.prepaid_balance = prepaid_balance === '' ? 0 : nonNeg(Number(prepaid_balance));
    if (max_auto_approve_limit !== undefined) updates.max_auto_approve_limit = max_auto_approve_limit === '' ? null : nonNeg(Number(max_auto_approve_limit));

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id);

    if (error) {
      return safeError('admin.update-agent', error, 500);
    }

    // Audit activation and money-field changes. NOTE: direct prepaid_balance
    // writes here bypass the append-only balance_transactions ledger; the
    // sanctioned path is the atomic adjust-balance flow. Logging the change at
    // least makes an out-of-band balance edit traceable. See the hardening
    // report for the recommended migration to route balance moves through the
    // ledger RPC.
    await writeAuditLog(supabase, {
      actorId: gate.userId,
      action: 'agent_account_updated',
      entityType: 'profile',
      entityId: id,
      changes: updates,
    });

    return NextResponse.json({ success: true, updates });
  } catch (err: unknown) {
    return safeError('admin.update-agent.catch', err, 500);
  }
}
