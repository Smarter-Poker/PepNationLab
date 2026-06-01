import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  friendly_name: z.string().trim().min(1).max(60).optional(),
});

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body ?? {});
  const friendlyName = parsed.success
    ? parsed.data.friendly_name ?? 'Authenticator App'
    : 'Authenticator App';

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || 'mfa_enroll_failed' },
      { status: 400 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  const factorId: string = d?.id;
  const secret: string = d?.totp?.secret ?? '';
  const otpauth: string = d?.totp?.uri ?? '';

  let qrPngDataUrl: string | null = null;
  if (otpauth) {
    try {
      qrPngDataUrl = await QRCode.toDataURL(otpauth, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 220,
      });
    } catch {
      qrPngDataUrl = null;
    }
  }

  await supabase
    .rpc('log_account_event', {
      p_user_id: user.id,
      p_event: 'mfa_enroll_started',
      p_details: { factor_id: factorId },
    })
    .then(() => null, () => null);

  return NextResponse.json({
    factor_id: factorId,
    secret,
    otpauth_url: otpauth,
    qr_png_data: qrPngDataUrl,
  });
}
