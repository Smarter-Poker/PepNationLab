import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { safeError } from '@/lib/api-error';
import { requireAgent, requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DeleteBody = z.object({
  target_id: z.string().uuid(),
  reason: z.string().max(500).optional().default(''),
});

const RestoreBody = z.object({
  target_id: z.string().uuid(),
});

/**
 * Account deletion 2026-07-29.
 * Soft delete: releases username / email / referral code / storefront slug so they
 * can be re-used, bans the auth user, freezes + deactivates the profile, and keeps
 * every order + financial ledger row intact. Reversible by an admin via DELETE-undo
 * (PATCH below). Authorization is enforced inside the SECURITY DEFINER RPC:
 * admin, or a transitive upline ancestor of the target.
 */
export async function POST(req: Request) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const supabase = await createClient();

  let body: z.infer<typeof DeleteBody>;
  try {
    body = DeleteBody.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_request', details: e.errors }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('soft_delete_account', {
    p_target_id: body.target_id,
    p_reason: body.reason ?? '',
  });

  if (error) {
    const msg = String(error.message || '');
    if (msg === 'unauthorized') {
      return NextResponse.json({ error: 'Your Session Expired. Please Sign In Again.' }, { status: 401 });
    }
    if (msg === 'forbidden') {
      return NextResponse.json({ error: 'This Account Is Not In Your Network.' }, { status: 403 });
    }
    if (msg === 'not_found') {
      return NextResponse.json({ error: 'Account Not Found.' }, { status: 404 });
    }
    if (msg === 'cannot_delete_self') {
      return NextResponse.json({ error: 'You Cannot Delete Your Own Account.' }, { status: 400 });
    }
    if (msg === 'cannot_delete_admin') {
      return NextResponse.json({ error: 'Admin Accounts Cannot Be Deleted.' }, { status: 400 });
    }
    if (msg.startsWith('has_downline:')) {
      const n = msg.split(':')[1] || '0';
      return NextResponse.json(
        {
          error: `This Account Still Has ${n} Active Account${n === '1' ? '' : 's'} In Its Downline. Move Or Delete Them First.`,
          downline_count: Number(n) || 0,
        },
        { status: 409 },
      );
    }
    return safeError('agent.delete-account', error);
  }

  return NextResponse.json({ ok: true, result: data });
}

/** Admin-only undo. Replays the saved identity snapshot back onto the account. */
export async function PATCH(req: Request) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createClient();

  let body: z.infer<typeof RestoreBody>;
  try {
    body = RestoreBody.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_request', details: e.errors }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('restore_account', {
    p_target_id: body.target_id,
  });

  if (error) {
    const msg = String(error.message || '');
    if (msg === 'unauthorized') {
      return NextResponse.json({ error: 'Your Session Expired. Please Sign In Again.' }, { status: 401 });
    }
    if (msg === 'forbidden') {
      return NextResponse.json({ error: 'Only Admins Can Restore A Deleted Account.' }, { status: 403 });
    }
    if (msg === 'not_found') {
      return NextResponse.json({ error: 'Account Not Found.' }, { status: 404 });
    }
    return safeError('agent.restore-account', error);
  }

  return NextResponse.json({ ok: true, result: data });
}
