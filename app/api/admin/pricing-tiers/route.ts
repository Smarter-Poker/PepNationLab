import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('pricing_tiers')
    .select('tier_name, multiplier, display_name, description')
    .order('tier_name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient();
  const body = await req.json().catch(() => ({}));

  const { tier_name, multiplier, display_name, description } = body;

  if (!tier_name || multiplier === undefined) {
    return NextResponse.json({ error: 'Missing Tier Name Or Multiplier Value' }, { status: 400 });
  }

  const numMultiplier = Number(multiplier);
  if (isNaN(numMultiplier) || numMultiplier < 1.0 || numMultiplier > 99.99) {
    return NextResponse.json({ error: 'Multiplier Must Be A Valid Number Between 1.0 And 99.99' }, { status: 400 });
  }

  const updates: any = {
    multiplier: numMultiplier,
    updated_at: new Date().toISOString(),
  };

  if (display_name) updates.display_name = display_name;
  if (description) updates.description = description;

  const { error } = await supabase
    .from('pricing_tiers')
    .update(updates)
    .eq('tier_name', tier_name);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
