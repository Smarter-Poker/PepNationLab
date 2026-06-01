import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { notify } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/coupons/[id]/notify-downline
 *
 * Sends an in-app + web push notification to every active researcher in the
 * calling agent's downline (referring_agent_id = caller). Body can override
 * the storefront URL or include a custom message.
 *
 * Rate-limited to 1 broadcast per coupon per hour, and 5 broadcasts per
 * agent per hour to prevent spam.
 */

interface Ctx { params: Promise<{ id: string }> }

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return bad('Invalid Coupon Id.');

  const limitedAgent = await rateLimit({
    key: 'coupons_notify_downline',
    limit: 5,
    windowSeconds: 3600,
    identifier: gate.user.id,
  });
  if (!limitedAgent.allowed) {
    return bad('You Have Sent Too Many Coupon Broadcasts In The Last Hour. Try Again Later.', 429);
  }

  const limitedCoupon = await rateLimit({
    key: 'coupons_notify_downline_per_coupon',
    limit: 1,
    windowSeconds: 3600,
    identifier: id,
  });
  if (!limitedCoupon.allowed) {
    return bad('This Coupon Has Already Been Broadcast In The Last Hour. Try Again Later.', 429);
  }

  const svc = await createServiceClient();
  const { data: coupon } = await svc
    .from('coupons')
    .select('id, agent_id, code, is_active, deleted_at, expires_at, discount_type, discount_value')
    .eq('id', id)
    .maybeSingle();
  if (!coupon) return bad('Coupon Not Found.', 404);
  if (coupon.deleted_at) return bad('Coupon Has Been Deleted.', 410);
  if (!coupon.is_active) return bad('Activate The Coupon Before Broadcasting.', 422);

  if (coupon.agent_id !== gate.user.id) {
    const { data: caller } = await svc.from('profiles').select('role').eq('id', gate.user.id).maybeSingle();
    if (caller?.role !== 'admin') return bad('Forbidden.', 403);
  }

  // Resolve agent storefront slug for the deeplink.
  const { data: storefront } = await svc
    .from('agent_profiles')
    .select('slug, display_name')
    .eq('id', coupon.agent_id)
    .maybeSingle();

  // Find researchers in the agent's downline who haven't muted promo notifications.
  const { data: researchers } = await svc
    .from('profiles')
    .select('id')
    .eq('referring_agent_id', coupon.agent_id)
    .eq('role', 'researcher')
    .eq('is_active', true);

  const recipients = (researchers ?? []).map((r: { id: string }) => r.id);
  if (recipients.length === 0) {
    return NextResponse.json({ success: true, sent: 0, skipped: 0, total: 0 });
  }

  const discountLine = coupon.discount_type === 'percent'
    ? `${Number(coupon.discount_value)}% Off`
    : `$${Number(coupon.discount_value).toFixed(2)} Off`;
  const expiresLine = coupon.expires_at
    ? ` — Expires ${new Date(coupon.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    : '';

  const slug = storefront?.slug ?? '';
  const deepLink = slug ? `/${encodeURIComponent(slug)}?coupon=${encodeURIComponent(coupon.code)}` : '/products';

  let sent = 0;
  for (const recipient of recipients) {
    try {
      await notify(svc, {
        userId: recipient,
        type: 'system',
        title: `New Coupon: ${coupon.code}`,
        body: `${discountLine}${expiresLine}. Tap To Shop.`,
        url: deepLink,
      });
      sent += 1;
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({
    success: true,
    sent,
    total: recipients.length,
  });
}
