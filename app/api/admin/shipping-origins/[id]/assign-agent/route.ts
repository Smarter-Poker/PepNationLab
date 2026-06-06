/**
 * POST   /api/admin/shipping-origins/[id]/assign-agent
 * DELETE /api/admin/shipping-origins/[id]/assign-agent
 *
 * Links or unlinks a shipping_origins row as the warehouse for a specific agent.
 * When linked, the agent's label purchases and storefront quotes will use their
 * own warehouse address instead of the platform default.
 *
 * POST body: { agent_id: string }
 *   Sets agent_profiles.warehouse_origin_id = [id] for the specified agent.
 *
 * DELETE body: { agent_id: string }
 *   Sets agent_profiles.warehouse_origin_id = null for the specified agent,
 *   reverting to the platform default shipping origin.
 *
 * Guards: requireAdmin - no MFA required for this read-ish assignment.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// POST - assign this origin to an agent
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: RouteParams) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id: originId } = await params;

  let body: { agent_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const agentId = typeof body.agent_id === 'string' ? body.agent_id.trim() : '';
  if (!agentId) {
    return NextResponse.json({ error: 'agent_id Is Required.' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Verify origin exists and is active.
  const { data: origin } = await supabase
    .from('shipping_origins')
    .select('id, label, name, is_active')
    .eq('id', originId)
    .maybeSingle();

  if (!origin) {
    return NextResponse.json({ error: 'Shipping Origin Not Found.' }, { status: 404 });
  }
  if (!origin.is_active) {
    return NextResponse.json(
      { error: 'Cannot Assign An Inactive Shipping Origin To An Agent.' },
      { status: 422 },
    );
  }

  // Verify agent exists.
  const { data: agent } = await supabase
    .from('agent_profiles')
    .select('id, display_name, slug, warehouse_origin_id')
    .eq('id', agentId)
    .maybeSingle();

  if (!agent) {
    return NextResponse.json({ error: 'Agent Not Found.' }, { status: 404 });
  }

  // Set the warehouse_origin_id on the agent profile.
  const { error: updateErr } = await supabase
    .from('agent_profiles')
    .update({ warehouse_origin_id: originId, updated_at: new Date().toISOString() })
    .eq('id', agentId);

  if (updateErr) {
    return NextResponse.json(
      { error: 'A database error occurred.' },
      { status: 500 },
    );
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'shipping_origin_assigned_to_agent',
    entity_type: 'agent_profiles',
    entity_id: agentId,
    changes: {
      origin_id: originId,
      origin_label: origin.label,
      origin_name: origin.name,
      previous_origin_id: agent.warehouse_origin_id ?? null,
      agent_slug: agent.slug,
    },
  });

  return NextResponse.json({
    ok: true,
    agent_id: agentId,
    agent_name: agent.display_name,
    origin_id: originId,
    origin_label: origin.label,
  });
}

// ---------------------------------------------------------------------------
// DELETE - unassign (revert to platform default)
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id: originId } = await params;

  let body: { agent_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const agentId = typeof body.agent_id === 'string' ? body.agent_id.trim() : '';
  if (!agentId) {
    return NextResponse.json({ error: 'agent_id Is Required.' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: agent } = await supabase
    .from('agent_profiles')
    .select('id, display_name, slug, warehouse_origin_id')
    .eq('id', agentId)
    .maybeSingle();

  if (!agent) {
    return NextResponse.json({ error: 'Agent Not Found.' }, { status: 404 });
  }

  if (agent.warehouse_origin_id !== originId) {
    return NextResponse.json(
      { error: 'This Origin Is Not Currently Assigned To That Agent.' },
      { status: 409 },
    );
  }

  const { error: updateErr } = await supabase
    .from('agent_profiles')
    .update({ warehouse_origin_id: null, updated_at: new Date().toISOString() })
    .eq('id', agentId);

  if (updateErr) {
    return NextResponse.json(
      { error: 'A database error occurred.' },
      { status: 500 },
    );
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'shipping_origin_unassigned_from_agent',
    entity_type: 'agent_profiles',
    entity_id: agentId,
    changes: {
      cleared_origin_id: originId,
      agent_slug: agent.slug,
    },
  });

  return NextResponse.json({
    ok: true,
    agent_id: agentId,
    agent_name: agent.display_name,
    warehouse_origin_id: null,
  });
}
