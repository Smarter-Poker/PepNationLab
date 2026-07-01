import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { randomUUID } from 'crypto';

interface Bundle {
  id: string;
  name: string;
  description: string;
  product_ids: string[];
  discount_percent: number;
  is_active: boolean;
  created_at: string;
}

// GET /api/agent/bundles - List all bundles for the current agent
export async function GET(req: NextRequest) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const { data: profile } = await supabase
      .from('agent_profiles')
      .select('bundles_config')
      .eq('id', gate.user.id)
      .single();

    return NextResponse.json({ data: profile?.bundles_config || [] });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/agent/bundles - Create a new bundle
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  // SACA: sub-agents have no agent_profiles row to store bundles_config on.
  // Reject explicitly so the UI surfaces a useful error instead of a silent
  // no-op or confusing 500.
  {
    const svc = await createServiceClient();
    const { data: caller } = await svc
      .from('profiles')
      .select('is_sub_agent')
      .eq('id', gate.user.id)
      .maybeSingle();
    if ((caller as { is_sub_agent?: boolean | null } | null)?.is_sub_agent === true) {
      return NextResponse.json(
        { error: 'Sub-Agents Cannot Create Bundles. Bundles Belong To The Storefront-Owning Agent.' },
        { status: 403 },
      );
    }
  }

  const body = await req.json().catch(() => ({}));
  const { name, description, product_ids, discount_percent } = body;

  if (!name || !Array.isArray(product_ids) || product_ids.length < 2) {
    return NextResponse.json({ error: 'Bundle Name And At Least 2 Products Are Required' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Get current bundles
  const { data: profile } = await supabase
    .from('agent_profiles')
    .select('bundles_config')
    .eq('id', gate.user.id)
    .single();

  const existing: Bundle[] = profile?.bundles_config || [];

  const newBundle: Bundle = {
    id: randomUUID(),
    name: name.trim(),
    description: (description || '').trim(),
    product_ids,
    discount_percent: Math.min(Math.max(Number(discount_percent) || 0, 0), 90),
    is_active: true,
    created_at: new Date().toISOString(),
  };

  const updated = [...existing, newBundle];

  const { error } = await supabase
    .from('agent_profiles')
    .update({ bundles_config: updated, updated_at: new Date().toISOString() })
    .eq('id', gate.user.id);

  if (error) {
    return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, bundle: newBundle });
}

// PATCH /api/agent/bundles - Toggle a bundle on/off
export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const { id, action } = body;

  if (!id) {
    return NextResponse.json({ error: 'Bundle ID Required' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: profile } = await supabase
    .from('agent_profiles')
    .select('bundles_config')
    .eq('id', gate.user.id)
    .single();

  const existing: Bundle[] = profile?.bundles_config || [];
  const updated = existing.map(b =>
    b.id === id ? { ...b, is_active: action === 'toggle' ? !b.is_active : b.is_active } : b
  );

  const { error } = await supabase
    .from('agent_profiles')
    .update({ bundles_config: updated, updated_at: new Date().toISOString() })
    .eq('id', gate.user.id);

  if (error) {
    return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/agent/bundles - Delete a bundle
export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: 'Bundle ID Required' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: profile } = await supabase
    .from('agent_profiles')
    .select('bundles_config')
    .eq('id', gate.user.id)
    .single();

  const existing: Bundle[] = profile?.bundles_config || [];
  const updated = existing.filter(b => b.id !== id);

  const { error } = await supabase
    .from('agent_profiles')
    .update({ bundles_config: updated, updated_at: new Date().toISOString() })
    .eq('id', gate.user.id);

  if (error) {
    return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
