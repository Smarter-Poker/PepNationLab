/**
 * GET /api/admin/shippo/status
 *
 * Returns the current platform Shippo connection status:
 *   { connected: boolean; mode: 'test'|'live'|null; last4: string|null;
 *     last_validated_at: string|null; webhook_configured: boolean }
 *
 * The API key is never returned — only the last4 display token.
 *
 * Guards: admin role only (no MFA needed for a read).
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();

  const { data: row } = await supabase
    .from('platform_shippo_credentials')
    .select('id, mode, api_key_last4, is_active, connected_at, last_validated_at, last_validation_error, webhook_secret_ciphertext')
    .eq('is_active', true)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({
      connected: false,
      mode: null,
      last4: null,
      last_validated_at: null,
      last_validation_error: null,
      webhook_configured: false,
      connected_at: null,
    });
  }

  return NextResponse.json({
    connected: true,
    mode: row.mode as 'test' | 'live',
    last4: row.api_key_last4 as string,
    last_validated_at: row.last_validated_at as string | null,
    last_validation_error: row.last_validation_error as string | null,
    webhook_configured: !!row.webhook_secret_ciphertext,
    connected_at: row.connected_at as string,
    credentials_id: row.id as string,
  });
}
