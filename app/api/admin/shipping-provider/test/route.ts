/**
 * POST /api/admin/shipping-provider/test
 *
 * Body: { address: AddressInput }
 *
 * Calls validateAddress using the active platform EasyPost key.
 * Returns the raw AddressValidationResult. Updates last_validated_at on success.
 *
 * Guards: admin role + same-origin CSRF (no MFA required - read-ish action).
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { validateAddress, type AddressInput } from '@/lib/shipping';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: { address?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const addr = body.address;
  if (!addr || typeof addr !== 'object') {
    return NextResponse.json({ error: 'address Is Required.' }, { status: 400 });
  }

  const a = addr as Record<string, unknown>;
  if (!a.street1 || !a.city || !a.state || !a.zip) {
    return NextResponse.json(
      { error: 'address.street1, city, state, and zip Are Required.' },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await validateAddress(addr as AddressInput);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'EasyPost unavailable.';
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Update last_validated_at on the active credentials row.
  if (result.isValid) {
    const supabase = await createServiceClient();
    await supabase
      .from('shipping_provider_credentials')
      .update({
        last_validated_at: new Date().toISOString(),
        last_validation_error: null,
      })
      .eq('provider', 'easypost')
      .eq('is_active', true);
  } else {
    const supabase = await createServiceClient();
    const errorText = result.messages.map((m) => m.text).join('; ').slice(0, 500);
    await supabase
      .from('shipping_provider_credentials')
      .update({ last_validation_error: errorText })
      .eq('provider', 'easypost')
      .eq('is_active', true);
  }

  return NextResponse.json(result);
}
