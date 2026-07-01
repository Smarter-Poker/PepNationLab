/**
 * POST /api/admin/shippo/connect
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin, assertMfaRecent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { encryptSecret, lastFour } from '@/lib/shippo-crypto';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const mfaErr = await assertMfaRecent(req, 5 * 60 * 1000);
  if (mfaErr) return mfaErr;

  let body: { api_key?: unknown; mode?: unknown; webhook_secret?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const apiKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';
  const mode = body.mode === 'live' ? 'live' : 'test';
  const webhookSecret = typeof body.webhook_secret === 'string' ? body.webhook_secret.trim() : null;

  if (!apiKey) return NextResponse.json({ error: 'api_key Is Required.' }, { status: 400 });
  if (!apiKey.startsWith('shippo_test_') && !apiKey.startsWith('shippo_live_')) return NextResponse.json({ error: 'api_key Must Start With shippo_test_ Or shippo_live_.' }, { status: 400 });

  let encrypted: ReturnType<typeof encryptSecret>;
  try { encrypted = encryptSecret(apiKey); } catch (err) { const msg = err instanceof Error ? err.message : 'Encryption failed.'; return NextResponse.json({ error: `Encryption Error: ${msg}` }, { status: 500 }); }

  const webhookEnc = webhookSecret ? encryptSecret(webhookSecret) : null;
  const supabase = await createServiceClient();

  const { data: inserted, error: insertErr } = await supabase.from('platform_shippo_credentials').insert({ mode, api_key_ciphertext: encrypted.ciphertext, api_key_iv: encrypted.iv, api_key_tag: encrypted.tag, api_key_last4: lastFour(apiKey), webhook_secret_ciphertext: webhookEnc?.ciphertext ?? null, webhook_secret_iv: webhookEnc?.iv ?? null, webhook_secret_tag: webhookEnc?.tag ?? null, is_active: true, connected_by: gate.userId }).select('id, mode, api_key_last4, connected_at').single();
  if (insertErr || !inserted) { console.error('Shippo connect insert failed:', insertErr?.message); return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 }); }

  await supabase.from('platform_shippo_credentials').update({ is_active: false }).eq('is_active', true).neq('id', inserted.id);
  await supabase.from('admin_audit_log').insert({ actor_id: gate.userId, action: 'shippo_connect', entity_type: 'platform_shippo_credentials', entity_id: inserted.id, changes: { mode, last4: lastFour(apiKey), webhook_secret_set: !!webhookSecret } });

  return NextResponse.json({ ok: true, id: inserted.id, mode: inserted.mode, last4: inserted.api_key_last4, connected_at: inserted.connected_at });
}
