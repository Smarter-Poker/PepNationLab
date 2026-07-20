const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const statementId = '68e92bb1-8c96-4971-beb1-e054c5f0d54e';
  
  // get the statement
  const { data: statement } = await supabase
    .from('weekly_statements')
    .select('*')
    .eq('id', statementId)
    .single();

  console.log("Current Statement:", statement);
  
  if (statement && statement.total_owed === 64) {
    console.log("Fixing statement to 58.50...");
    const { data: updated, error } = await supabase
      .from('weekly_statements')
      .update({ total_cogs: 58.5, total_owed: 58.5 })
      .eq('id', statementId)
      .select('*')
      .single();
    console.log("Updated Statement:", updated);
    if (error) console.error(error);
  } else {
    console.log("Statement not 64, or not found.");
  }
}

main();
