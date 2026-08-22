import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import CheckoutForm from './CheckoutForm';
import './checkout.css';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ agent?: string }>;
}

export default async function CheckoutPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const params = await searchParams;
  // Sanitize the agentSlug - only allow alphanumeric + hyphens/underscores
  const rawAgent = params.agent ?? null;
  const agentSlug = typeof rawAgent === 'string' && /^[a-zA-Z0-9_-]+$/.test(rawAgent) ? rawAgent : null;

  if (!user) {
    const redirectTarget = agentSlug
      ? `/checkout?agent=${encodeURIComponent(agentSlug)}`
      : '/checkout';
    redirect(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
  }

  // Get profile — include checkout-required identity fields for the profile gate
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, first_name, last_name, phone, role, tier, referring_agent_id, is_sub_agent')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    redirect('/login');
  }

  // Fetch PNL pricing configuration to pass down.
  // SECURITY: raw tier multipliers are platform-internal pricing and must never
  // leak to researchers. Only agents/super_agents/admins may receive them; every
  // other viewer gets an empty map. (Researchers already see finished retail
  // prices computed elsewhere -- they never need the raw multipliers.)
  const canSeeTierMultipliers =
    profile.role === 'agent' ||
    profile.role === 'super_agent' ||
    profile.role === 'admin';

  const tierMultipliers: Record<string, number> = {};
  if (canSeeTierMultipliers) {
    // Use service client so agent-level RLS does not block the read
    const supabaseService = await createServiceClient();
    const { data: tiers } = await supabaseService
      .from('pricing_tiers')
      .select('tier_name, multiplier');

    (tiers ?? []).forEach((t: any) => {
      tierMultipliers[t.tier_name] = Number(t.multiplier);
    });
  }

  // Resolve the agent's payment handles so CheckoutForm shows only the
  // handles this specific agent has configured (not hardcoded platform handles).
  // Prefer agentSlug (storefront URL) -> then researcher's referring_agent_id.
  let agentPaymentHandles: Record<string, string> = {};
  let minOverallQty = 1;
  let minOrderQty = 1;
  let volumeDiscountsEnabled = true;
  let manufacturerStore = false;
  try {

    if (agentSlug) {
      const { data: ap } = await supabase
        .from('agent_profiles')
        .select('id, payment_handles, min_overall_qty, min_order_qty, volume_pricing_enabled, is_manufacturer_store')
        .eq('slug', agentSlug)
        .maybeSingle();
      if (ap?.payment_handles) {
        if (typeof ap.payment_handles === 'string') {
          try { agentPaymentHandles = JSON.parse(ap.payment_handles); } catch {}
        } else {
          agentPaymentHandles = ap.payment_handles as Record<string, string>;
        }
      }
      if (ap?.min_overall_qty) {
        minOverallQty = ap.min_overall_qty;
      }
      if (ap?.min_order_qty) {
        minOrderQty = ap.min_order_qty;
      }
      if ((ap as { volume_pricing_enabled?: boolean | null } | null)?.volume_pricing_enabled === false) {
        volumeDiscountsEnabled = false;
      }
      if ((ap as { is_manufacturer_store?: boolean | null } | null)?.is_manufacturer_store === true) {
        manufacturerStore = true;
      }
      // The server-side checkout and approval routes gate manufacturer
      // behavior on profiles.is_manufacturer - honor that flag here too so
      // the client form and the server can never disagree.
      const apId = (ap as { id?: string | null } | null)?.id;
      if (!manufacturerStore && apId) {
        const { data: agentProfile } = await supabase
          .from('profiles')
          .select('is_manufacturer')
          .eq('id', apId)
          .maybeSingle();
        if (agentProfile?.is_manufacturer === true) manufacturerStore = true;
      }
    } else if (profile.referring_agent_id) {
      const { data: ap } = await supabase
        .from('agent_profiles')
        .select('payment_handles, min_overall_qty, min_order_qty, volume_pricing_enabled, is_manufacturer_store')
        .eq('id', profile.referring_agent_id)
        .maybeSingle();
      if (ap?.payment_handles) {
        if (typeof ap.payment_handles === 'string') {
          try { agentPaymentHandles = JSON.parse(ap.payment_handles); } catch {}
        } else {
          agentPaymentHandles = ap.payment_handles as Record<string, string>;
        }
      }
      if (ap?.min_overall_qty) {
        minOverallQty = ap.min_overall_qty;
      }
      if (ap?.min_order_qty) {
        minOrderQty = ap.min_order_qty;
      }
      if ((ap as { volume_pricing_enabled?: boolean | null } | null)?.volume_pricing_enabled === false) {
        volumeDiscountsEnabled = false;
      }
      if ((ap as { is_manufacturer_store?: boolean | null } | null)?.is_manufacturer_store === true) {
        manufacturerStore = true;
      }
      // Same server-authoritative manufacturer flag check as the slug branch.
      if (!manufacturerStore) {
        const { data: agentProfile } = await supabase
          .from('profiles')
          .select('is_manufacturer')
          .eq('id', profile.referring_agent_id)
          .maybeSingle();
        if (agentProfile?.is_manufacturer === true) manufacturerStore = true;
      }
    }
  } catch {
    // Non-blocking - checkout still works without agent handles
  }

  // Manufacturer stores never run quantity discounts, whatever the column says.
  if (manufacturerStore) {
    volumeDiscountsEnabled = false;
  }

  // Profile gate: compute which checkout-required fields are missing.
  // Admins are excluded — they place test orders and shouldn't be gated.
  const missingCheckoutFields: string[] = [];
  if (profile.role !== 'admin') {
    if (!profile.first_name?.trim()) missingCheckoutFields.push('first_name');
    if (!profile.last_name?.trim())  missingCheckoutFields.push('last_name');
    if (!profile.phone?.trim())      missingCheckoutFields.push('phone');
  }

  return (
    <CheckoutForm
      userProfile={profile}
      userEmail={user.email ?? ''}
      tierMultipliers={tierMultipliers}
      agentSlug={agentSlug}
      agentPaymentHandles={agentPaymentHandles}
      minOverallQty={minOverallQty}
      minOrderQty={minOrderQty}
      volumeDiscountsEnabled={volumeDiscountsEnabled}
      manufacturerStore={manufacturerStore}
      missingCheckoutFields={missingCheckoutFields}
      profileInitialValues={{
        first_name: profile.first_name ?? '',
        last_name:  profile.last_name  ?? '',
        phone:      profile.phone      ?? '',
      }}
    />
  );
}
