import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('pricing_tiers')
      .select('tier_name, multiplier, display_name, description')
      .order('tier_name');

    if (error) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[admin/pricing-tiers] GET error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createAdminClient();
    const body = await req.json().catch(() => ({}));

    const { tier_name, multiplier, display_name, description } = body;

    if (!tier_name || multiplier === undefined) {
      return NextResponse.json({ error: 'Missing Tier Name Or Multiplier Value' }, { status: 400 });
    }

    // Whitelist tier_name so an unknown value cannot silently no-op into a 200.
    const VALID_TIERS = new Set(['tier_1', 'tier_2', 'tier_3']);
    if (!VALID_TIERS.has(tier_name)) {
      return NextResponse.json({ error: 'Unknown Tier Name' }, { status: 400 });
    }

    const numMultiplier = Number(multiplier);
    if (isNaN(numMultiplier) || numMultiplier < 1.0 || numMultiplier > 99.99) {
      return NextResponse.json({ error: 'Multiplier Must Be A Valid Number Between 1.0 And 99.99' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      multiplier: numMultiplier,
      updated_at: new Date().toISOString(),
    };

    if (display_name) updates.display_name = display_name;
    if (description) updates.description = description;

    const { data: updated, error } = await supabase
      .from('pricing_tiers')
      .update(updates)
      .eq('tier_name', tier_name)
      .select('tier_name');

    if (error) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'Tier Not Found' }, { status: 404 });
    }

    // Cascade the new multiplier to the house ladder that actually drives agent
    // wholesale cost (markup = multiplier - 1, tier_N maps to level N), then
    // recompute every store's retail prices so all agents on this tier adjust
    // immediately. A DB trigger mirrors this cascade as a safety net.
    const tierLevel = parseInt(tier_name.replace('tier_', ''), 10);
    if (Number.isFinite(tierLevel)) {
      const { error: houseErr } = await supabase
        .from('house_tiers')
        .update({ markup: numMultiplier - 1, updated_at: new Date().toISOString() })
        .eq('level', tierLevel);
      if (houseErr) {
        console.error('[admin/pricing-tiers] house_tiers sync failed:', houseErr.message);
      }
      const { error: recalcErr } = await supabase.rpc('recalculate_agent_product_prices');
      if (recalcErr) {
        console.error('[admin/pricing-tiers] retail recalc failed:', recalcErr.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/pricing-tiers] POST error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}
