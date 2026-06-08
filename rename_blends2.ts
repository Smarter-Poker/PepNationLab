import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // L-Carnitine -> is_stack = true
  await supabase.from('compounds').update({ 
    is_stack: true, 
    display_name: 'The Furnace Stack (L-Carnitine Blend)' 
  }).eq('slug', 'l-carnitine');

  await supabase.from('products').update({ 
    name: 'The Furnace Stack (L-Carnitine Blend)' 
  }).eq('compound_slug', 'l-carnitine');

  // Lipo-C
  await supabase.from('compounds').update({ 
    display_name: 'The Skinny Shot (Lipo-C Blend)' 
  }).eq('slug', 'lipo-c');

  await supabase.from('products').update({ 
    name: 'The Skinny Shot (Lipo-C Blend)' 
  }).eq('compound_slug', 'lipo-c');

  // Lemon Bottle
  await supabase.from('compounds').update({ 
    display_name: 'The Lipolysis Stack (Lemon Bottle)' 
  }).eq('slug', 'lemon-bottle');

  await supabase.from('products').update({ 
    name: 'The Lipolysis Stack (Lemon Bottle)' 
  }).eq('compound_slug', 'lemon-bottle');

  console.log("Renamed and flagged all three!");
}
main();
