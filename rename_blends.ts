import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  await supabase.from('products').update({ name: 'The Lipo-C Blend' }).eq('compound_slug', 'lipo-c');
  await supabase.from('products').update({ name: 'The Lemon Bottle Blend' }).eq('compound_slug', 'lemon-bottle');
  console.log("Renamed Lipo-C and Lemon Bottle products!");
}
main();
