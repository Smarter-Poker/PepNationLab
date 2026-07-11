/**
 * POST /api/admin/shipping-provider/rotate
 *
 * Rotates the platform EasyPost API key. The key prefix determines the mode:
 * EZAK = live, EZTK = test. The new key is verified against the EasyPost API
 * before it is encrypted and stored.
 *
 * Guards: admin role + recent MFA (5 min) + same-origin CSRF.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin, assertMfaRecent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { encryptSecret, lastFour } from '@/lib/shipping-crypto';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Live key check against EasyPost: 200 = valid, 401/403 = invalid.
 * Any other outcome (timeout, 5xx) is indeterminate and does not block.
 */
async function verifyEasyPostKey(key: string): Promise<boolean | null> {
  try {
    const res = await fetch('https://api.easypost.com/v2/carrier_accounts', {
      headers: { Authorization: 'Basic ' + Buffer.from(`${key}:`).toString('base64') },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 200) return true;
    if (res.status === 401 || res.status === 403) return false;
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const mfaErr = await assertMfaRecent(req, 5 * 60 * 1000);
  if (mfaErr) return mfaErr;

  let body: { api_key?: unknown; webhook_secret?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const apiKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';
  const webhookSecret = typeof body.webhook_secret === 'string' ? body.webhook_secret.trim() : null;

  if (!apiKey) {
    return NextResponse.json({ error: 'api_key Is Required.' }, { status: 400 });
  }
  if (!apiKey.startsWith('EZAK') && !apiKey.startsWith('EZTK')) {
    return NextResponse.json(
      { error: 'api_key Must Start With EZAK (Live) Or EZTK (Test).' },
      { status: 400 },
    );
  }

  const keyValid = await verifyEasyPostKey(apiKey);
  if (keyValid === false) {
    return NextResponse.json(
      { error: 'EasyPost Rejected This API Key. Check The Key And Try Again.' },
      { status: 400 },
    );
  }

  let encrypted: ReturnType<typeof encryptSecret>;
  try {
    encrypted = encryptSecret(apiKey);
  } catch (err) {
    console.error('Shipping provider rotate encryption error:', err);
    return NextResponse.json({ error: 'Encryption Error.' }, { status: 500 });
  }

  const webhookEnc = webhookSecret ? encryptSecret(webhookSecret) : null;
  const mode: 'test' | 'live' = apiKey.startsWith('EZAK') ? 'live' : 'test';

  const supabase = await createServiceClient();

  const { data: currentActive } = await supabase
    .from('shipping_provider_credentials')
    .select('id')
    .eq('provider', 'easypost')
    .eq('is_active', true)
    .maybeSingle();

  const previousId = currentActive?.id ?? null;

  const { data: inserted, error: insertErr } = await supabase
    .from('shipping_provider_credentials')
    .insert({
      provider: 'easypost',
      mode,
      api_key_ciphertext: encrypted.ciphertext,
      api_key_iv: encrypted.iv,
      api_key_tag: encrypted.tag,
      api_key_last4: lastFour(apiKey),
      webhook_secret_ciphertext: webhookEnc?.ciphertext ?? null,
      webhook_secret_iv: webhookEnc?.iv ?? null,
      webhook_secret_tag: webhookEnc?.tag ?? null,
      is_active: true,
      connected_by: gate.userId,
      rotated_from: previousId,
    })
    .select('id, mode, api_key_last4, connected_at')
    .maybeSingle();

  if (insertErr || !inserted) {
    console.error('Shipping provider rotate insert failed:', insertErr?.message);
    return NextResponse.json(
      { error: 'A Database Error Occurred.' },
      { status: 500 },
    );
  }

  await supabase
    .from('shipping_provider_credentials')
    .update({ is_active: false })
    .eq('is_active', true)
    .neq('id', inserted.id);

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'shipping_provider_rotate',
    entity_type: 'shipping_provider_credentials',
    entity_id: inserted.id,
    changes: {
      provider: 'easypost',
      mode,
      last4: lastFour(apiKey),
      rotated_from: previousId,
      webhook_secret_set: !!webhookSecret,
      key_verified: keyValid === true,
    },
  });

  return NextResponse.json({
    ok: true,
    id: inserted.id,
    mode: inserted.mode,
    last4: inserted.api_key_last4,
    rotated_from: previousId,
    connected_at: inserted.connected_at,
  });
}
