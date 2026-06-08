import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  await supabase.from('compounds').update({ is_stack: true, display_name: 'The Lipo-C Blend' }).eq('slug', 'lipo-c');
  await supabase.from('compounds').update({ is_stack: true, display_name: 'The Lemon Bottle Blend' }).eq('slug', 'lemon-bottle');
  console.log("Updated Lipo-C and Lemon Bottle to be Stacks!");
}
main();
