import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function generateSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9\-]/g, '');
}

async function main() {
  console.log('--- Starting Agent Store Setup ---');

  // 1. Get Adam
  const { data: adam, error: adamErr } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', 'adam')
    .single();

  if (adamErr || !adam) {
    console.error('Could not find Adam:', adamErr);
    process.exit(1);
  }

  // 2. Get Tier 1 Multiplier
  const { data: tier1, error: tierErr } = await supabase
    .from('pricing_tiers')
    .select('multiplier')
    .eq('tier_name', 'tier_1')
    .single();

  if (tierErr || !tier1) {
    console.error('Could not find Tier 1:', tierErr);
    process.exit(1);
  }

  const tier1Multiplier = Number(tier1.multiplier) || 1.3;
  const agentMultiplier = tier1Multiplier * 1.2; // 20% markup

  console.log(`Adam ID: ${adam.id}`);
  console.log(`Tier 1 Multiplier: ${tier1Multiplier}, Agent Store Multiplier: ${agentMultiplier}`);

  // 3. Get Active Products
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, base_cost')
    .eq('is_active', true);

  if (prodErr || !products || products.length === 0) {
    console.error('No active products found.');
    process.exit(1);
  }

  // 4. Get Adam's Downline Agents
  const { data: agents, error: agentsErr } = await supabase
    .from('profiles')
    .select('id, full_name, username')
    .eq('parent_agent_id', adam.id)
    .eq('role', 'agent')
    .eq('is_sub_agent', false);

  if (agentsErr || !agents) {
    console.error('Could not fetch agents:', agentsErr);
    process.exit(1);
  }

  console.log(`Found ${agents.length} agents under Adam.`);

  let profilesCreated = 0;
  let productsCreated = 0;

  for (const agent of agents) {
    let targetSlug = agent.username ? generateSlug(agent.username) : generateSlug(agent.full_name || 'store');
    
    // Attempt to update existing profile or insert new one
    console.log(`Updating storefront for ${agent.username} to slug /${targetSlug}`);
    
    const { error: upsertApErr } = await supabase
      .from('agent_profiles')
      .upsert({
        id: agent.id,
        slug: targetSlug,
        display_name: agent.full_name || agent.username,
        is_active: true
      }, { onConflict: 'id' });

    if (upsertApErr) {
      console.error(`Failed to upsert storefront for ${agent.username}:`, upsertApErr);
      continue;
    }
    profilesCreated++;

    // UPSERT products for this agent
    const agentProductsToInsert = products.map((p) => {
      const retailPrice = Math.round((Number(p.base_cost) * agentMultiplier) * 100) / 100;
      return {
        agent_id: agent.id,
        product_id: p.id,
        retail_price: retailPrice,
        margin_percent: 50,
        is_visible: true,
        sort_order: 0
      };
    });

    console.log(`  -> Upserting ${agentProductsToInsert.length} products...`);
    const { error: upsertProdErr } = await supabase
      .from('agent_products')
      .upsert(agentProductsToInsert, { onConflict: 'agent_id,product_id' });

    if (upsertProdErr) {
      console.error(`  -> Failed to upsert products for ${agent.username}:`, upsertProdErr);
    } else {
      productsCreated += agentProductsToInsert.length;
    }
  }

  console.log(`--- Finished. Created ${profilesCreated} storefronts and ${productsCreated} products. ---`);
}

main().catch(console.error);
