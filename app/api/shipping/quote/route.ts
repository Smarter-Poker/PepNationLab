/**
 * POST /api/shipping/quote
 *
 * Rate-limited: 60 requests / min / IP.
 *
 * Body:
 *   {
 *     shipping_address: { street1, city, state, zip, country? }
 *     items: Array<{ product_id: string; quantity: number }>
 *     agent_slug?: string
 *   }
 *
 * Returns live Shippo carrier rates. Falls back to weight-bracket rates from
 * the `shipping_rates` table when Shippo is unavailable (surfaced as
 * `estimated: true` in the response so the UI shows "Estimated Shipping").
 *
 * Auth: authenticated user (any role). Public callers via agent storefronts
 * are allowed - the rate does not expose sensitive data.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { quoteRates, type AddressInput } from '@/lib/shippo';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

const ORIGIN_FALLBACK: AddressInput = {
  name: 'PepNationLab Fulfillment',
  street1: '1 Warehouse Way',
  city: 'Los Angeles',
  state: 'CA',
  zip: '90001',
  country: 'US',
  phone: '3105550000',
  email: 'support@pepnationlab.com',
};

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  // Rate limit
  const ip = getClientIp(req);
  const rl = await rateLimit({ key: 'shipping_quote', limit: 60, windowSeconds: 60, identifier: ip });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too Many Rate Requests. Please Wait And Try Again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  // Auth - must be signed in.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: {
    shipping_address?: unknown;
    items?: unknown;
    agent_slug?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const addrRaw = body.shipping_address;
  if (!addrRaw || typeof addrRaw !== 'object') {
    return NextResponse.json({ error: 'shipping_address Is Required.' }, { status: 400 });
  }

  const a = addrRaw as Record<string, unknown>;
  const toAddr: AddressInput = {
    street1: String(a.street1 || '').trim(),
    city: String(a.city || '').trim(),
    state: String(a.state || '').trim(),
    zip: String(a.zip || a.zipCode || '').trim(),
    country: String(a.country || 'US'),
    name: String(a.fullName || a.name || '').trim() || undefined,
  };
  if (!toAddr.street1 || !toAddr.city || !toAddr.state || !toAddr.zip) {
    return NextResponse.json(
      { error: 'shipping_address Must Include street1, city, state, And zip.' },
      { status: 400 },
    );
  }

  // Compute total weight from items.
  const items = Array.isArray(body.items) ? body.items : [];
  let totalWeightOz = 0;
  let totalQty = 0;
  if (items.length > 0) {
    const service = await createServiceClient();
    for (const it of items as Array<{ product_id?: unknown; quantity?: unknown }>) {
      const pid = typeof it.product_id === 'string' ? it.product_id : null;
      const qty = Math.max(1, Number(it.quantity) || 1);
      if (!pid) continue;
      const { data: prod } = await service
        .from('products')
        .select('weight_oz')
        .eq('id', pid)
        .maybeSingle();
      const w = Number(prod?.weight_oz) || 4;
      totalWeightOz += qty * w;
      totalQty += qty;
    }
  }
  const weightOz = Math.max(1, Math.round(totalWeightOz));

  // Determine parcel dimensions.
  let lengthIn = 6, widthIn = 4, heightIn = 4;
  if (totalQty > 3 && totalQty <= 10) { lengthIn = 9; widthIn = 6; heightIn = 3; }
  else if (totalQty > 10) { lengthIn = 12; widthIn = 9; heightIn = 4; }

  // Resolve ship-from origin.
  // Priority: agent warehouse_origin_id (via agent_slug) → platform default → LA fallback.
  // Using the agent's real warehouse ensures checkout rates match the actual label cost.
  let fromAddr = ORIGIN_FALLBACK;
  try {
    const service = await createServiceClient();

    // 1) If agent_slug provided, find the agent's own warehouse first.
    const agentSlug = typeof body.agent_slug === 'string' ? body.agent_slug.trim() : null;
    if (agentSlug) {
      const { data: agentProfile } = await service
        .from('agent_profiles')
        .select('warehouse_origin_id, warehouse_address, display_name')
        .eq('slug', agentSlug)
        .eq('is_active', true)
        .maybeSingle();

      if (agentProfile?.warehouse_origin_id) {
        // Post-M1 canonical path: agent has a linked shipping_origins row.
        const { data: agentOrigin } = await service
          .from('shipping_origins')
          .select('name, company, street1, street2, city, state, zip, country, phone, email')
          .eq('id', agentProfile.warehouse_origin_id)
          .eq('is_active', true)
          .maybeSingle();
        if (agentOrigin) {
          fromAddr = {
            name: agentOrigin.name,
            company: (agentOrigin.company as string | null) ?? undefined,
            street1: agentOrigin.street1,
            street2: (agentOrigin.street2 as string | null) ?? undefined,
            city: agentOrigin.city,
            state: agentOrigin.state,
            zip: agentOrigin.zip,
            country: agentOrigin.country,
            phone: agentOrigin.phone,
            email: agentOrigin.email,
          };
        }
      } else if (agentProfile?.warehouse_address && typeof agentProfile.warehouse_address === 'object') {
        // Legacy path: agent still has JSONB warehouse_address, not yet migrated.
        const wh = agentProfile.warehouse_address as Record<string, unknown>;
        const street1 = String(wh.street1 ?? wh.street ?? '').trim();
        const city = String(wh.city ?? '').trim();
        const state = String(wh.state ?? '').trim();
        const zip = String(wh.zip ?? wh.zipCode ?? '').trim();
        if (street1 && city && state && zip) {
          fromAddr = {
            name: String(wh.name ?? agentProfile.display_name ?? 'Agent Warehouse'),
            street1,
            street2: typeof wh.street2 === 'string' ? wh.street2 : undefined,
            city,
            state,
            zip,
            country: String(wh.country ?? 'US') || 'US',
            phone: typeof wh.phone === 'string' ? wh.phone : '0000000000',
            email: typeof wh.email === 'string' && wh.email.includes('@') ? wh.email : 'support@pepnationlab.com',
          };
        }
      }
    }

    // 2) If no agent-specific origin resolved, fall back to platform default.
    if (fromAddr === ORIGIN_FALLBACK) {
      const { data: origin } = await service
        .from('shipping_origins')
        .select('name, company, street1, street2, city, state, zip, country, phone, email')
        .eq('is_default', true)
        .eq('is_active', true)
        .maybeSingle();
      if (origin) {
        fromAddr = {
          name: origin.name,
          company: (origin.company as string | null) ?? undefined,
          street1: origin.street1,
          street2: (origin.street2 as string | null) ?? undefined,
          city: origin.city,
          state: origin.state,
          zip: origin.zip,
          country: origin.country,
          phone: origin.phone,
          email: origin.email,
        };
      }
    }
  } catch {
    /* use hardcoded LA fallback */
  }

  // Try live Shippo quote.
  try {
    const result = await quoteRates({
      from: fromAddr,
      to: toAddr,
      parcel: { lengthIn, widthIn, heightIn, weightOz },
    });

    if (result.ok && result.result.rates.length > 0) {
      return NextResponse.json({
        ok: true,
        estimated: false,
        mode: result.result.mode,
        rates: result.result.rates.slice(0, 5).map((r) => ({
          carrier: r.carrier,
          service: r.serviceLevelName,
          service_token: r.serviceLevelToken,
          amount_cents: r.amountCents,
          amount_dollars: (r.amountCents / 100).toFixed(2),
          estimated_days: r.estimatedDays ?? null,
          arrives_by: r.arrivesBy ?? null,
        })),
        cheapest_cents: result.result.rates[0].amountCents,
        weight_oz: weightOz,
      });
    }
  } catch {
    /* fall through to bracket fallback */
  }

  // Bracket fallback.
  let bracketDollars = 12;
  try {
    const service = await createServiceClient();
    const { data: rates } = await service
      .from('shipping_rates')
      .select('rate, min_weight_oz, max_weight_oz')
      .lte('min_weight_oz', weightOz)
      .gt('max_weight_oz', weightOz)
      .order('min_weight_oz', { ascending: false })
      .limit(1);
    if (rates && rates.length > 0) bracketDollars = Number(rates[0].rate);
  } catch { /* use $12 */ }

  return NextResponse.json({
    ok: true,
    estimated: true,
    rates: [
      {
        carrier: 'Estimated',
        service: 'Standard Shipping',
        service_token: 'estimated',
        amount_cents: Math.round(bracketDollars * 100),
        amount_dollars: bracketDollars.toFixed(2),
        estimated_days: null,
        arrives_by: null,
      },
    ],
    cheapest_cents: Math.round(bracketDollars * 100),
    weight_oz: weightOz,
  });
}
