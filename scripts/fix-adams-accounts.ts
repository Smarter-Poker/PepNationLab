import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

function generateSlug(fullName: string): string {
  const base = fullName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const suffix = crypto.randomBytes(3).toString('hex');
  return base ? `${base}-${suffix}` : `agent-${suffix}`;
}

async function main() {
  const adamId = 'ab2327cb-f58c-4e78-8f9e-899a49259f71';

  const { data: children } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_sub_agent, parent_agent_id')
    .eq('parent_agent_id', adamId);

  if (!children || children.length === 0) {
    console.log('No sub-agent accounts found under Adam to fix.');
    return;
  }

  for (const child of children) {
    console.log(`\nFixing account: ${child.full_name} (${child.id})`);
    
    // 1. Update to is_sub_agent = false
    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({ is_sub_agent: false })
      .eq('id', child.id);

    if (updateProfileError) {
      console.error(`Failed to update profile for ${child.full_name}:`, updateProfileError);
      continue;
    }
    console.log(`- Updated is_sub_agent to false`);

    // 2. Check if agent_profiles exists
    const { data: existingAgentProfile } = await supabase
      .from('agent_profiles')
      .select('id')
      .eq('id', child.id)
      .maybeSingle();

    if (!existingAgentProfile) {
      const slug = generateSlug(child.full_name || 'agent');

      const { error: insertAgentError } = await supabase
        .from('agent_profiles')
        .insert({
          id: child.id,
          slug: slug,
          display_name: child.full_name || 'Agent',
          is_active: true,
          primary_color: '#00C4BC',
        });

      if (insertAgentError) {
        console.error(`- Failed to insert agent_profile for ${child.full_name}:`, insertAgentError);
      } else {
        console.log(`- Created agent_profile with slug: ${slug}`);
      }
    } else {
      console.log(`- Agent profile already exists.`);
    }

    // 3. Trigger should have seeded agent_products, but let's verify
    const { count, error: countError } = await supabase
      .from('agent_products')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', child.id);

    if (countError) {
      console.error(`- Failed to check agent_products:`, countError);
    } else if (count === 0) {
      console.log(`- WARNING: No agent_products found for ${child.full_name}. Missing trigger?`);
      // Fallback: seed them manually
      const { data: products } = await supabase.from('products').select('id, base_cost').eq('is_active', true);
      const inserts = products?.map(p => ({
        agent_id: child.id,
        product_id: p.id,
        retail_price: Number(p.base_cost) * 10,
        is_visible: true
      })) || [];
      if (inserts.length > 0) {
        await supabase.from('agent_products').insert(inserts);
        console.log(`- Manually seeded ${inserts.length} agent_products.`);
      }
    } else {
      console.log(`- Verified ${count} agent_products exist.`);
    }
  }

  console.log('\nAll done.');
}

main().catch(console.error);
