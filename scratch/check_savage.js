const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .ilike('action', '%product%')
    .order('created_at', { ascending: false })
    .limit(20);

  fs.writeFileSync('scratch/output13.json', JSON.stringify(logs, null, 2));
}

main();
