/**
 * GET /api/admin/agents/warehouse-origins
 *
 * Returns all active agents with their current warehouse_origin_id and the
 * resolved origin details (if set). Used by the admin shipping settings UI
 * to show which warehouse each agent ships from.
 *
 * Guards: requireAdmin.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();

  // Fetch all active agents with their current warehouse assignment.
  const { data: agents, error: agentsErr } = await supabase
    .from('agent_profiles')
    .select('id, display_name, slug, warehouse_origin_id, warehouse_address')
    .eq('is_active', true)
    .order('display_name', { ascending: true });

  if (agentsErr) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  // Collect the distinct origin IDs that are actually in use.
  const usedOriginIds = [
    ...new Set(
      (agents ?? [])
        .map((a) => a.warehouse_origin_id as string | null)
        .filter((id): id is string => !!id),
    ),
  ];

  // Fetch those origins so we can embed their details.
  let originMap: Map<string, { label: string; name: string; city: string; state: string }> = new Map();
  if (usedOriginIds.length > 0) {
    const { data: origins } = await supabase
      .from('shipping_origins')
      .select('id, label, name, city, state')
      .in('id', usedOriginIds);
    for (const o of origins ?? []) {
      originMap.set(o.id, { label: o.label, name: o.name, city: o.city, state: o.state });
    }
  }

  const result = (agents ?? []).map((a) => {
    const origin = a.warehouse_origin_id ? originMap.get(a.warehouse_origin_id as string) ?? null : null;
    const hasLegacyWarehouse = !!(a.warehouse_address && typeof a.warehouse_address === 'object');

    return {
      id: a.id,
      display_name: a.display_name,
      slug: a.slug,
      warehouse_origin_id: a.warehouse_origin_id ?? null,
      warehouse_origin: origin,
      // Flags the UI that this agent still relies on the old JSONB field.
      uses_legacy_warehouse: hasLegacyWarehouse && !a.warehouse_origin_id,
      // No warehouse at all — will fall through to platform default.
      uses_platform_default: !a.warehouse_origin_id && !hasLegacyWarehouse,
    };
  });

  return NextResponse.json({ agents: result });
}
