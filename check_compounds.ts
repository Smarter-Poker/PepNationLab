import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: compounds } = await supabase.from('compounds').select('slug, display_name, is_stack');
  
  if (compounds) {
    for (const c of compounds) {
      if (!c.is_stack && (c.display_name.includes('+') || c.display_name.toLowerCase().includes('stack') || c.display_name.toLowerCase().includes('blend'))) {
        console.log(`Hidden Stack Candidate: ${c.display_name} (slug: ${c.slug})`);
      }
    }
  }
}
main();
