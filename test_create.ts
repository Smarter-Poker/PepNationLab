import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: { user } } = await supabase.auth.admin.createUser({
    email: 'testagent99@example.com',
    password: 'password123',
    email_confirm: true,
  });
  console.log("Created user:", user?.id);
  
  if (user) {
    const res = await fetch('http://localhost:3000/api/admin/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testagent99',
        password: 'password123',
        firstName: 'Test',
        lastName: 'Agent',
        account_role: 'agent',
        tier: 'tier_3',
        account_type: 'prepaid',
        prepaid_balance: '100',
        slug: 'testagent99',
        display_name: 'Test Agent 99'
      })
    });
    const json = await res.json();
    console.log("Create agent route response:", res.status, json);
  }
}
run();
