import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: agentProfile } = await supabase.from('agent_profiles').select('id').eq('slug', 'savagebrands').single();
  const agentId = agentProfile.id;

  const productId = '851f2ad7-5838-40ac-9c36-c875bd5a4a51'; // Shred Stack (Tirzepatide + AOD9604)

  const { data, error } = await supabase
    .from('agent_products')
    .update({ custom_image_url: '/images/savage-brands/savage-shredder-stack.jpg' })
    .eq('agent_id', agentId)
    .eq('product_id', productId);

  console.log('Update result:', { data, error });
}
main();
