import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import QRCode from 'qrcode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/coupons/[id]/qr
 *
 * Returns a PNG QR-code that encodes the storefront deep-link with the
 * coupon code pre-applied via ?coupon=. Marketing-ready asset for
 * print, flyers, or social.
 */

interface Ctx { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid Coupon Id.' }, { status: 400 });
  }

  const svc = await createServiceClient();
  const { data: coupon } = await svc
    .from('coupons')
    .select('id, code, agent_id, deleted_at')
    .eq('id', id)
    .maybeSingle();
  if (!coupon || coupon.deleted_at) {
    return NextResponse.json({ error: 'Coupon Not Found.' }, { status: 404 });
  }

  if (coupon.agent_id !== gate.user.id) {
    const { data: caller } = await svc.from('profiles').select('role').eq('id', gate.user.id).maybeSingle();
    if (caller?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
  }

  const { data: storefront } = await svc
    .from('agent_profiles')
    .select('slug')
    .eq('id', coupon.agent_id)
    .maybeSingle();
  if (!storefront?.slug) {
    return NextResponse.json({ error: 'Agent Has No Storefront.' }, { status: 422 });
  }

  const origin = (process.env.NEXT_PUBLIC_APP_URL || 'https://pepnationlab.com').replace(/\/$/, '');
  const url = `${origin}/${encodeURIComponent(storefront.slug)}?coupon=${encodeURIComponent(coupon.code)}`;

  try {
    const png = await QRCode.toBuffer(url, {
      errorCorrectionLevel: 'M',
      type: 'png',
      margin: 2,
      width: 512,
      color: { dark: '#0F1923', light: '#FFFFFF' },
    });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': `inline; filename="coupon-${coupon.code}.png"`,
      },
    });
  } catch (err) {
    console.error('[coupons/qr] generation failed:', err);
    return NextResponse.json({ error: 'Failed To Generate QR Code.' }, { status: 500 });
  }
}
