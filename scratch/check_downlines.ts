import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: savage } = await supabase.from('agent_profiles').select('id').eq('slug', 'savagebrands').single();
  if (!savage) return;

  const { data: downlines } = await supabase
    .from('agent_profiles')
    .select('id, slug, parent_agent_id')
    .eq('parent_agent_id', savage.id);

  console.log("Downlines of savagebrands:", downlines?.length);
  if (downlines && downlines.length > 0) {
    console.log("First downline:", downlines[0].slug);
    const { count } = await supabase
      .from('agent_products')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', downlines[0].id)
      .is('custom_image_url', null);
    console.log("Products with null image for downline:", count);
  }
}
main().catch(console.error);
