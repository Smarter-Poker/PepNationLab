import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CheckoutForm from './CheckoutForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ agent?: string }>;
}

export default async function CheckoutPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const params = await searchParams;
  // Sanitize the agentSlug — only allow alphanumeric + hyphens/underscores
  const rawAgent = params.agent ?? null;
  const agentSlug = rawAgent && /^[a-zA-Z0-9_-]+$/.test(rawAgent) ? rawAgent : null;

  if (!user) {
    const redirectTarget = agentSlug
      ? `/checkout?agent=${encodeURIComponent(agentSlug)}`
      : '/checkout';
    redirect(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
  }

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, tier, referring_agent_id')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  // Fetch PNL pricing configuration to pass down
  const { data: tiers } = await supabase
    .from('pricing_tiers')
    .select('tier_name, multiplier');

  const tierMultipliers: Record<string, number> = {};
  tiers?.forEach(t => {
    tierMultipliers[t.tier_name] = Number(t.multiplier);
  });

  return (
    <CheckoutForm
      userProfile={profile}
      userEmail={user.email ?? ''}
      tierMultipliers={tierMultipliers}
      agentSlug={agentSlug}
    />
  );
}
