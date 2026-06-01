import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

const DeleteSchema = z.object({
  factor_id: z.string().min(1),
  code: z.string().min(4).max(10),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    return NextResponse.json(
      { error: error.message || 'mfa_list_failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({ factors: data?.all ?? [] });
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(body);
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
      { error: 'Verification Required Before Removing MFA.' },
      { status: 403 },
    );
  }

  const proof = await supabase.auth.mfa.verify({
    factorId: parsed.data.factor_id,
    challengeId: challenge.data.id,
    code: parsed.data.code.replace(/\s+/g, ''),
  });
  if (proof.error) {
    return NextResponse.json(
      { error: 'Incorrect Verification Code.' },
      { status: 401 },
    );
  }

  const { error } = await supabase.auth.mfa.unenroll({
    factorId: parsed.data.factor_id,
  });
  if (error) {
    return NextResponse.json(
      { error: error.message || 'mfa_unenroll_failed' },
      { status: 400 },
    );
  }

  await supabase
    .rpc('log_account_event', {
      p_user_id: user.id,
      p_event: 'mfa_unenrolled',
      p_details: { factor_id: parsed.data.factor_id },
    })
    .then(() => null, () => null);

  return NextResponse.json({ unenrolled: true });
}
