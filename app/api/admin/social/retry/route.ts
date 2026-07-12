import { z } from "zod";
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { createServiceClient } from '@/lib/supabase/server';
import { safeError } from '@/lib/api-error';

/**
 * Admin-only: act on a queued social post.
 *
 *   POST /api/admin/social/retry
 *   { id, action: 'retry' | 'delete' }
 *
 * retry  - reset a failed/blocked post to 'pending' and make it due now, so the
 *          hourly cron picks it up. The compliance gate re-runs on the next
 *          attempt, so a still-non-compliant caption will simply block again.
 * delete - remove a post from the queue. Never removes one that is mid-post
 *          ('posting') or already 'posted'.
 */

const POSTBodySchema = z.any();

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  
  const __rawBody = await req.json().catch(() => ({}));
  const __bodyParse = POSTBodySchema.safeParse(__rawBody);
  if (!__bodyParse.success) {
    return NextResponse.json({ error: "Invalid Request Body", details: __bodyParse.error.issues }, { status: 400 });
  }
  const body = __bodyParse.data;

  const id = typeof body.id === 'string' ? body.id : '';
  const action = body.action === 'delete' ? 'delete' : 'retry';

  if (!id) return NextResponse.json({ error: 'Missing Post Id' }, { status: 400 });

  const supabase = await createServiceClient();

  const { data: existing, error: loadErr } = await supabase
    .from('social_posts')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();

  if (loadErr) return safeError('admin.social.retry.load', loadErr, 500, 'Failed To Load Post.');
  if (!existing) return NextResponse.json({ error: 'Post Not Found' }, { status: 404 });

  const status = (existing as { status: string }).status;

  if (action === 'delete') {
    if (status === 'posting' || status === 'posted') {
      return NextResponse.json({ error: 'Cannot Delete A Posted Or In-Flight Post' }, { status: 409 });
    }
    const { error } = await supabase.from('social_posts').delete().eq('id', id);
    if (error) return safeError('admin.social.retry.delete', error, 500, 'Failed To Delete Post.');
    return NextResponse.json({ ok: true, action: 'delete' });
  }

  // retry
  if (status !== 'failed' && status !== 'blocked') {
    return NextResponse.json({ error: 'Only Failed Or Blocked Posts Can Be Retried' }, { status: 409 });
  }
  const { error } = await supabase
    .from('social_posts')
    .update({
      status: 'pending',
      error: null,
      compliance_notes: null,
      compliance_checked: false,
      scheduled_for: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return safeError('admin.social.retry.update', error, 500, 'Failed To Requeue Post.');

  return NextResponse.json({ ok: true, action: 'retry' });
}
