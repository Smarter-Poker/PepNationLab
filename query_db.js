const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('compounds')
    .select('slug, display_name, is_stack, stack_components')
    .in('slug', ['lemon-bottle', 'l-carnitine-blend', 'lipo-c-blend', 'bpc-157-tb-500-blend', 'wolverine-stack']);
  console.log(error || data);
}
check();
