const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data: order } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', '770b5503-79a6-493a-8fc3-7dea78d3046a')
    .single();

  fs.writeFileSync('scratch/output12.json', JSON.stringify({
    order
  }, null, 2));
}

main();
