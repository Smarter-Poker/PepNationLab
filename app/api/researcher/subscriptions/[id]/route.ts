import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

const PAYMENT_METHODS = new Set(['zelle', 'cashapp', 'venmo', 'apple_pay']);
const STATUSES = new Set(['active', 'paused', 'cancelled']);

interface OwnershipResult {
  ok: boolean;
  status?: number;
  error?: string;
  userId?: string;
  subscription?: { id: string; researcher_id: string; status: string; cadence_days: number };
}

async function loadAndCheckOwnership(id: string): Promise<OwnershipResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: 'Unauthorized' };

  const service = await createServiceClient();
  const { data: sub, error } = await service
    .from('subscriptions')
    .select('id, researcher_id, status, cadence_days')
    .eq('id', id)
    .maybeSingle();

  if (error) return { ok: false, status: 500, error: error.message };
  if (!sub) return { ok: false, status: 404, error: 'Subscription Not Found' };
  if (sub.researcher_id !== user.id) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  return { ok: true, userId: user.id, subscription: sub as any };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { id } = await params;
  const gate = await loadAndCheckOwnership(id);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid Body' }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body?.status === 'string') {
    if (!STATUSES.has(body.status)) {
      return NextResponse.json({ error: 'Invalid Status' }, { status: 400 });
    }
    // B-01: Cancelled subscriptions are terminal — researchers cannot re-activate them.
    // Only admins can reinstate a cancelled subscription via the admin API.
    if (gate.subscription!.status === 'cancelled' && body.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Cancelled subscriptions cannot be reactivated. Please create a new subscription.' },
        { status: 422 }
      );
    }
    update.status = body.status;
    if (body.status === 'paused') {
      update.paused_at = new Date().toISOString();
    } else if (body.status === 'cancelled') {
      update.cancelled_at = new Date().toISOString();
    } else if (body.status === 'active') {
      // Resuming — clear paused_at and recompute next_run_at from current cadence
      // so a paused subscription does not fire immediately on resume.
      update.paused_at = null;
      const cadence = Number(body?.cadence_days ?? gate.subscription!.cadence_days);
      update.next_run_at = new Date(Date.now() + cadence * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  if (body?.cadence_days !== undefined) {
    const c = Number(body.cadence_days);
    if (!Number.isFinite(c) || c < 7 || c > 365) {
      return NextResponse.json({ error: 'cadence_days Must Be Between 7 And 365' }, { status: 400 });
    }
    update.cadence_days = c;
  }

  if (body?.payment_method !== undefined) {
    if (!PAYMENT_METHODS.has(String(body.payment_method))) {
      return NextResponse.json({ error: 'Invalid Payment Method' }, { status: 400 });
    }
    update.payment_method = String(body.payment_method);
  }

  if (body?.shipping_address !== undefined) {
    const addr = body.shipping_address;
    if (addr === null) {
      update.shipping_address = null;
    } else if (typeof addr === 'object') {
      for (const k of ['street', 'city', 'state', 'zip']) {
        if (!addr[k]) {
          return NextResponse.json({ error: `Shipping Address Missing ${k}` }, { status: 400 });
        }
      }
      update.shipping_address = addr;
    } else {
      return NextResponse.json({ error: 'Invalid Shipping Address' }, { status: 400 });
    }
  }

  const service = await createServiceClient();
  const { data: updated, error: updError } = await service
    .from('subscriptions')
    .update(update)
    .eq('id', id)
    .eq('researcher_id', gate.userId!)
    .select('id, status, cadence_days, next_run_at, paused_at, cancelled_at, payment_method, shipping_address')
    .single();

  if (updError || !updated) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  return NextResponse.json({ subscription: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { id } = await params;
  const gate = await loadAndCheckOwnership(id);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const service = await createServiceClient();
  const { error } = await service
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('researcher_id', gate.userId!);

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
