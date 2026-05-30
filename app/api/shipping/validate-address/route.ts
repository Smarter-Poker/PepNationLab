/**
 * POST /api/shipping/validate-address
 *
 * Rate-limited: 60 requests / min / IP.
 *
 * Body: { address: AddressInput }
 *
 * Validates an address via Shippo and returns isValid, messages, suggestion.
 * Used by the checkout form on address field blur (debounced on the client).
 *
 * Auth: authenticated user (any role).
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { validateAddress, type AddressInput } from '@/lib/shippo';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  // Rate limit
  const ip = getClientIp(req);
  const rl = await rateLimit({
    key: 'shipping_validate_address',
    limit: 60,
    windowSeconds: 60,
    identifier: ip,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests. Please Wait And Try Again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: { address?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const addrRaw = body.address;
  if (!addrRaw || typeof addrRaw !== 'object') {
    return NextResponse.json({ error: 'address Is Required.' }, { status: 400 });
  }

  const a = addrRaw as Record<string, unknown>;
  const addr: AddressInput = {
    name: String(a.name || a.fullName || '').trim() || undefined,
    street1: String(a.street1 || '').trim(),
    street2: String(a.street2 || '').trim() || undefined,
    city: String(a.city || '').trim(),
    state: String(a.state || '').trim(),
    zip: String(a.zip || a.zipCode || '').trim(),
    country: String(a.country || 'US'),
    phone: String(a.phone || '').trim() || undefined,
    email: String(a.email || '').trim() || undefined,
  };

  if (!addr.street1 || !addr.city || !addr.state || !addr.zip) {
    return NextResponse.json(
      { error: 'address Must Include street1, city, state, And zip.' },
      { status: 400 },
    );
  }

  try {
    const result = await validateAddress(addr);
    return NextResponse.json(result);
  } catch (err) {
    // Shippo not configured or unavailable — return a soft ok so checkout
    // doesn't block. The server-side label purchase will validate again.
    const msg = err instanceof Error ? err.message : 'Shippo unavailable';
    return NextResponse.json({
      isValid: true,
      messages: [{ text: `Address Validation Skipped: ${msg}` }],
      suggestion: null,
    });
  }
}
