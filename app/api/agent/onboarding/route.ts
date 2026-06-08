import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

/**
 * GET/POST /api/agent/onboarding
 *
 * Single backend for the role-tailored onboarding wizard (super agent / agent
 * / sub-agent). GET returns the computed step list + completion percentage,
 * prefilled with the data each step needs. POST performs the per-step writes
 * (profile, warehouse, markup, acknowledgments) and the final completion.
 *
 * All writes are scoped to the authenticated caller's own row via the service
 * client. The service connection is not the `authenticated` Postgres role, so
 * the protect_profile_columns trigger does not fire on it -- meaning we MUST
 * build explicit, allow-listed update objects and never echo client input
 * into protected columns (role, tier, commission_pct, balances, etc.).
 */

// Default super-agent markup (percent; stored as a decimal fraction).
const SUPER_AGENT_DEFAULT_MARKUP_PCT = 50;

type WizardRole = 'super_agent' | 'agent' | 'sub_agent';

function resolveRole(p: { role: string | null; is_super_agent: boolean | null; is_sub_agent: boolean | null }): WizardRole | null {
  if (p.is_sub_agent === true) return 'sub_agent';
  if (p.role === 'super_agent' || p.is_super_agent === true) return 'super_agent';
  if (p.role === 'agent') return 'agent';
  return null;
}

function warehouseComplete(w: Record<string, unknown> | null | undefined): boolean {
  if (!w) return false;
  return Boolean(w.street1 && w.city && w.state && w.zip);
}

function slugIsCustom(slug: string | null | undefined): boolean {
  if (!slug) return false;
  // A freshly provisioned storefront gets an "agent-xxxx" placeholder slug.
  return !/^agent(?:-|$)/i.test(slug);
}

/** Build the ordered, role-tailored step list with derived completion. */
function buildSteps(args: {
  role: WizardRole;
  mustChangePassword: boolean;
  profileComplete: boolean;
  warehouseDone: boolean;
  storefrontDone: boolean;
  progress: Record<string, unknown>;
}) {
  const { role, mustChangePassword, profileComplete, warehouseDone, storefrontDone, progress } = args;
  const ack = (k: string) => progress?.[k] === true;

  const steps: Array<{ key: string; label: string; done: boolean }> = [];

  // 1. Password (only when it was set by someone else and not yet changed).
  if (mustChangePassword) {
    steps.push({ key: 'password', label: 'Secure Your Password', done: false });
  }

  // 2. Install + notifications (all roles).
  steps.push({ key: 'notifications', label: 'Install The App And Turn On Notifications', done: ack('notifications_ack') });

  // 3. Verify profile (all roles).
  steps.push({ key: 'profile', label: 'Confirm Your Contact Details', done: profileComplete });

  if (role === 'super_agent' || role === 'agent') {
    // 4. Warehouse address.
    steps.push({ key: 'warehouse', label: 'Add Your Warehouse Address', done: warehouseDone });
    // 5. Storefront config.
    steps.push({ key: 'storefront', label: 'Set Up Your Storefront', done: storefrontDone });
    // 6. Product management + markup tutorial.
    steps.push({ key: 'products', label: 'Learn Product Pricing And Markup', done: ack('product_tutorial_ack') });
    // 7. Downstream pricing (super -> agents markup, agent -> sub-agent commission).
    steps.push({
      key: 'downstream',
      label: role === 'super_agent' ? 'Set Your Agent Markup' : 'Set Your Sub-Agent Commissions',
      done: ack('downstream_tutorial_ack'),
    });
  } else {
    // Sub-agent: read-only commission explainer.
    steps.push({ key: 'commission_info', label: 'Understand How You Earn', done: ack('downstream_tutorial_ack') });
  }

  return steps;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const service = await createServiceClient();

  const { data: profile } = await service
    .from('profiles')
    .select('id, role, is_super_agent, is_sub_agent, parent_agent_id, first_name, last_name, email, phone, username, must_change_password, custom_markup_override, commission_pct, onboarding_progress, onboarding_completed_at')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: 'profile_not_found' }, { status: 404 });

  const role = resolveRole(profile);
  if (!role) {
    // Researchers/admins are never onboarded through this wizard.
    return NextResponse.json({ role: null, applicable: false, completed: true });
  }

  const progress = (profile.onboarding_progress as Record<string, unknown>) ?? {};

  // Storefront-owning roles need their agent_profiles row.
  let storefront: { slug: string | null; display_name: string | null; warehouse_address: Record<string, unknown> | null } | null = null;
  let warehouseDone = false;
  let storefrontDone = false;
  if (role === 'super_agent' || role === 'agent') {
    const { data: ap } = await service
      .from('agent_profiles')
      .select('slug, display_name, warehouse_address')
      .eq('id', user.id)
      .maybeSingle();
    storefront = {
      slug: (ap?.slug as string) ?? null,
      display_name: (ap?.display_name as string) ?? null,
      warehouse_address: (ap?.warehouse_address as Record<string, unknown>) ?? null,
    };
    warehouseDone = warehouseComplete(storefront.warehouse_address);
    storefrontDone = slugIsCustom(storefront.slug);
  }

  // Sub-agent: surface the parent's name + storefront for the explainer.
  let parent: { name: string | null; slug: string | null; commission_pct: number | null } | null = null;
  if (role === 'sub_agent') {
    let parentName: string | null = null;
    let parentSlug: string | null = null;
    if (profile.parent_agent_id) {
      const { data: par } = await service
        .from('profiles')
        .select('full_name, username')
        .eq('id', profile.parent_agent_id)
        .maybeSingle();
      parentName = (par?.full_name as string) ?? (par?.username as string) ?? null;
      const { data: parAp } = await service
        .from('agent_profiles')
        .select('slug')
        .eq('id', profile.parent_agent_id)
        .maybeSingle();
      parentSlug = (parAp?.slug as string) ?? null;
    }
    parent = {
      name: parentName,
      slug: parentSlug,
      commission_pct: (profile as { commission_pct?: number | null }).commission_pct ?? null,
    };
  }

  const profileComplete = Boolean(
    (profile.first_name && String(profile.first_name).trim()) &&
    (profile.last_name && String(profile.last_name).trim()) &&
    (profile.phone && String(profile.phone).trim()) &&
    (profile.email && String(profile.email).trim()),
  );

  const steps = buildSteps({
    role,
    mustChangePassword: profile.must_change_password === true,
    profileComplete,
    warehouseDone,
    storefrontDone,
    progress,
  });

  const doneCount = steps.filter((s) => s.done).length;
  const completionPct = steps.length === 0 ? 100 : Math.round((doneCount / steps.length) * 100);

  // Markup prefill: stored override (as %), else the super-agent default.
  const storedMarkup = profile.custom_markup_override != null ? Number(profile.custom_markup_override) * 100 : null;
  const markupDefaultPct = role === 'super_agent' ? SUPER_AGENT_DEFAULT_MARKUP_PCT : (storedMarkup ?? 0);

  return NextResponse.json({
    role,
    applicable: true,
    completed: profile.onboarding_completed_at != null,
    completion_pct: completionPct,
    steps,
    profile: {
      first_name: profile.first_name ?? '',
      last_name: profile.last_name ?? '',
      email: profile.email ?? '',
      phone: profile.phone ?? '',
      username: profile.username ?? '',
      must_change_password: profile.must_change_password === true,
    },
    storefront,
    markup: {
      stored_pct: storedMarkup,
      default_pct: markupDefaultPct,
    },
    parent,
    progress,
  });
}

const ProfileSchema = z.object({
  first_name: z.string().trim().min(1).max(60),
  last_name: z.string().trim().min(1).max(60),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().min(7).max(40),
});

const WarehouseSchema = z.object({
  street1: z.string().trim().min(1).max(120),
  street2: z.string().trim().max(120).optional().default(''),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(40),
  zip: z.string().trim().min(3).max(20),
  country: z.string().trim().min(2).max(40).optional().default('US'),
});

const PostSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('ack'), key: z.enum(['notifications', 'product_tutorial', 'downstream_tutorial']) }),
  z.object({ action: z.literal('profile'), data: ProfileSchema }),
  z.object({ action: z.literal('warehouse'), data: WarehouseSchema }),
  z.object({ action: z.literal('markup'), markup_pct: z.number().min(0).max(500) }),
  z.object({ action: z.literal('complete') }),
]);

const ACK_COLUMN: Record<string, string> = {
  notifications: 'notifications_ack',
  product_tutorial: 'product_tutorial_ack',
  downstream_tutorial: 'downstream_tutorial_ack',
};

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('id, role, is_super_agent, is_sub_agent, onboarding_progress, must_change_password, first_name, last_name, email, phone, custom_markup_override')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'profile_not_found' }, { status: 404 });

  const role = resolveRole(profile);
  if (!role) return NextResponse.json({ error: 'not_onboardable' }, { status: 403 });

  const action = parsed.data.action;

  if (action === 'ack') {
    const col = ACK_COLUMN[parsed.data.key];
    const progress = { ...((profile.onboarding_progress as Record<string, unknown>) ?? {}), [col]: true };
    const { error } = await service.from('profiles').update({ onboarding_progress: progress }).eq('id', user.id);
    if (error) return NextResponse.json({ error: 'ack_failed' }, { status: 500 });
    return NextResponse.json({ ok: true, progress });
  }

  if (action === 'profile') {
    const { first_name, last_name, email, phone } = parsed.data.data;
    const full_name = `${first_name} ${last_name}`.trim();
    const { error } = await service
      .from('profiles')
      .update({ first_name, last_name, email, phone, full_name })
      .eq('id', user.id);
    if (error) return NextResponse.json({ error: 'profile_update_failed' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'warehouse') {
    if (role === 'sub_agent') {
      return NextResponse.json({ error: 'sub_agents_have_no_warehouse' }, { status: 403 });
    }
    const w = parsed.data.data;
    const warehouse_address = {
      street1: w.street1,
      street2: w.street2 || '',
      city: w.city,
      state: w.state,
      zip: w.zip,
      country: w.country || 'US',
    };
    const { error } = await service
      .from('agent_profiles')
      .update({ warehouse_address })
      .eq('id', user.id);
    if (error) return NextResponse.json({ error: 'warehouse_update_failed' }, { status: 500 });
    return NextResponse.json({ ok: true, warehouse_address });
  }

  if (action === 'markup') {
    if (role === 'sub_agent') {
      return NextResponse.json({ error: 'sub_agents_have_no_markup' }, { status: 403 });
    }
    // Store as a decimal fraction (50% -> 0.50) in the uncapped override column.
    const fraction = Math.round((parsed.data.markup_pct / 100) * 10000) / 10000;
    const { error } = await service
      .from('profiles')
      .update({ custom_markup_override: fraction })
      .eq('id', user.id);
    if (error) return NextResponse.json({ error: 'markup_update_failed' }, { status: 500 });
    return NextResponse.json({ ok: true, markup_pct: parsed.data.markup_pct });
  }

  if (action === 'complete') {
    // Server-side re-derivation of required steps so a client cannot complete
    // the wizard with gaps. Mirror buildSteps' "done" logic for required items.
    const progress = (profile.onboarding_progress as Record<string, unknown>) ?? {};
    const ack = (k: string) => progress?.[k] === true;

    const missing: string[] = [];
    if (profile.must_change_password === true) missing.push('password');
    if (!ack('notifications_ack')) missing.push('notifications');
    const profileComplete = Boolean(
      (profile.first_name && String(profile.first_name).trim()) &&
      (profile.last_name && String(profile.last_name).trim()) &&
      (profile.phone && String(profile.phone).trim()) &&
      (profile.email && String(profile.email).trim()),
    );
    if (!profileComplete) missing.push('profile');

    if (role === 'super_agent' || role === 'agent') {
      const { data: ap } = await service
        .from('agent_profiles')
        .select('slug, warehouse_address')
        .eq('id', user.id)
        .maybeSingle();
      if (!warehouseComplete((ap?.warehouse_address as Record<string, unknown>) ?? null)) missing.push('warehouse');
      if (!slugIsCustom((ap?.slug as string) ?? null)) missing.push('storefront');
      if (!ack('product_tutorial_ack')) missing.push('products');
      if (!ack('downstream_tutorial_ack')) missing.push('downstream');
    } else {
      if (!ack('downstream_tutorial_ack')) missing.push('commission_info');
    }

    if (missing.length > 0) {
      return NextResponse.json({ error: 'incomplete', missing }, { status: 409 });
    }

    const { error } = await service
      .from('profiles')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) return NextResponse.json({ error: 'complete_failed' }, { status: 500 });
    return NextResponse.json({ ok: true, completed: true });
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
