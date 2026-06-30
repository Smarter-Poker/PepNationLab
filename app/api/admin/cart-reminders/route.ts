import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const supabase = await createAdminClient();

  // Get researchers with non-empty carts
  const { data: researchers, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, cart_state, cart_updated_at, last_cart_reminder_at')
    .eq('role', 'researcher')
    .not('cart_state', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Filter those who haven't been reminded in 24h
  const eligible = (researchers || []).filter(r => {
    if (!r.last_cart_reminder_at) return true;
    return new Date(r.last_cart_reminder_at) < twentyFourHoursAgo;
  });

  // Update last_cart_reminder_at for all eligible
  if (eligible.length > 0) {
    await supabase
      .from('profiles')
      .update({ last_cart_reminder_at: now.toISOString() })
      .in('id', eligible.map(r => r.id));
  }

  return NextResponse.json({ success: true, reminded: eligible.length });
}
