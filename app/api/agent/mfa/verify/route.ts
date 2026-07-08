import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  factor_id: z.string().min(1),
  code: z.string().min(4).max(10),
});

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Defense-in-depth brute-force cap on MFA code verification, keyed per user
  // and per IP (in addition to Supabase GoTrue's own throttling).
  const mfaRl = await rateLimit({
    key: 'mfa_verify',
    limit: 10,
    windowSeconds: 300,
    identifier: `${user.id}:${getClientIp(req)}`,
  });
  if (!mfaRl.allowed) {
    return NextResponse.json({ error: 'Too Many Attempts. Please Wait And Try Again.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const challenge = await supabase.auth.mfa.challenge({
    factorId: parsed.data.factor_id,
  });
  if (challenge.error || !challenge.data) {
    return NextResponse.json(
      { error: challenge.error?.message || 'mfa_challenge_failed' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.auth.mfa.verify({
    factorId: parsed.data.factor_id,
    challengeId: challenge.data.id,
    code: parsed.data.code.replace(/\s+/g, ''),
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || 'mfa_verify_failed' },
      { status: 400 },
    );
  }

  await supabase
    .rpc('log_account_event', {
      p_user_id: user.id,
      p_event: 'mfa_enrolled',
      p_details: { factor_id: parsed.data.factor_id },
    })
    .then(() => null, () => null);

  return NextResponse.json({ verified: true, data });
}
