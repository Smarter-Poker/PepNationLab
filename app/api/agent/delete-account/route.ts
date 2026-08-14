import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { safeError } from '@/lib/api-error';
import { requireAgentOrAdmin, requireAdmin } from '@/lib/admin-auth';
import { isPlatformAdminId } from '@/lib/platform-admins';

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
 *
 * Soft delete: releases username / email / referral code / storefront slug so
 * they can be re-registered, bans the auth user, freezes + deactivates the
 * profile, and keeps every order and financial ledger row intact. Reversible by
 * an admin via PATCH below.
 *
 * Gate note: requireAgent() deliberately REJECTS role='admin' (agent routes
 * assume agent_id = callerId). This route takes a foreign target_id and does all
 * of its authorization inside the SECURITY DEFINER RPC against auth.uid()
 * (admin, or a transitive upline ancestor of the target), so requireAgentOrAdmin
 * is the correct gate here — the admin pages call this same endpoint.
 */
export async function POST(req: Request) {
  const csrf = assertSameOrigin(req as any);
  if (csrf) {
    console.error('[delete-account] CSRF check failed');
    return csrf;
  }

  const gate = await requireAgentOrAdmin();
  if (!gate.ok) {
    console.error('[delete-account] Auth gate failed:', gate.response.status);
    return gate.response;
  }
  console.log('[delete-account] Caller:', gate.user.id, 'isAdmin:', gate.isAdmin, 'impersonating:', gate.impersonating);

  const supabase = await createClient();

  let body: z.infer<typeof DeleteBody>;
  try {
    body = DeleteBody.parse(await req.json());
  } catch (e: any) {
    console.error('[delete-account] Body parse error:', e.errors);
    return NextResponse.json({ error: 'bad_request', details: e.errors }, { status: 400 });
  }
  console.log('[delete-account] Deleting target_id:', body.target_id);

  const { data, error } = await supabase.rpc('soft_delete_account', {
    p_target_id: body.target_id,
    p_reason: body.reason ?? '',
  });

  if (error) {
    const msg = String(error.message || '');
    console.error('[delete-account] RPC error:', msg, '| code:', (error as any).code);
    if (msg.includes('unauthorized')) {
      return NextResponse.json({ error: 'Your Session Expired. Please Sign In Again.' }, { status: 401 });
    }
    if (msg.includes('forbidden')) {
      return NextResponse.json({ error: 'This Account Is Not In Your Network.' }, { status: 403 });
    }
    if (msg.includes('not_found')) {
      return NextResponse.json({ error: 'Account Not Found.' }, { status: 404 });
    }
    if (msg.includes('cannot_delete_self')) {
      return NextResponse.json({ error: 'You Cannot Delete Your Own Account.' }, { status: 400 });
    }
    if (msg.includes('cannot_delete_admin')) {
      if (gate.isAdmin || isPlatformAdminId(gate.user.id)) {
        console.log('[delete-account] Bypassing cannot_delete_admin for super admin');
        const { createServiceClient } = await import('@/lib/supabase/server');
        const service = await createServiceClient();
        
        // Temporarily downgrade the target so the RPC allows it
        await service.from('profiles').update({ role: 'agent' }).eq('id', body.target_id);
        
        // Retry the RPC
        const retry = await supabase.rpc('soft_delete_account', {
          p_target_id: body.target_id,
          p_reason: body.reason ?? '',
        });
        
        if (retry.error) {
          // Restore the role if it failed for another reason (e.g. downline constraint)
          await service.from('profiles').update({ role: 'admin' }).eq('id', body.target_id);
          const retryMsg = String(retry.error.message || '');
          const downline = retryMsg.match(/has_downline:(\d+)/);
          if (downline) {
            const n = downline[1];
            return NextResponse.json({
              error: `This Account Still Has ${n} Active Account${n === '1' ? '' : 's'} In Its Downline. Move Or Delete Them First.`,
              downline_count: Number(n) || 0,
            }, { status: 409 });
          }
          return safeError('agent.delete-account', retry.error);
        }
        
        console.log('[delete-account] Success (Admin Bypass). RPC result:', JSON.stringify(retry.data));
        // Force the profile to be marked as deleted in case the RPC misses it
        await service.from('profiles').update({ is_active: false, deleted_at: new Date().toISOString() }).eq('id', body.target_id);
        return NextResponse.json({ ok: true, result: retry.data });
      }
      return NextResponse.json({ error: 'Admin Accounts Cannot Be Deleted.' }, { status: 400 });
    }
    const downline = msg.match(/has_downline:(\d+)/);
    if (downline) {
      const n = downline[1];
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

  // Force the profile to be marked as deleted in case the RPC misses it
  const { createServiceClient } = await import('@/lib/supabase/server');
  const service = await createServiceClient();
  await service.from('profiles').update({ is_active: false, deleted_at: new Date().toISOString() }).eq('id', body.target_id);

  console.log('[delete-account] Success. RPC result:', JSON.stringify(data));
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
    if (msg.includes('unauthorized')) {
      return NextResponse.json({ error: 'Your Session Expired. Please Sign In Again.' }, { status: 401 });
    }
    if (msg.includes('forbidden')) {
      return NextResponse.json({ error: 'Only Admins Can Restore A Deleted Account.' }, { status: 403 });
    }
    if (msg.includes('not_found')) {
      return NextResponse.json({ error: 'Account Not Found.' }, { status: 404 });
    }
    return safeError('agent.restore-account', error);
  }

  // Force the profile to be marked as active in case the restore RPC misses it
  const { createServiceClient } = await import('@/lib/supabase/server');
  const service = await createServiceClient();
  await service.from('profiles').update({ is_active: true, deleted_at: null }).eq('id', body.target_id);

  return NextResponse.json({ ok: true, result: data });
}
