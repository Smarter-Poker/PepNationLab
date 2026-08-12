const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
});

async function run() {
  const res = await pool.query(`
    SELECT event_object_table AS table_name,
           trigger_name,
           event_manipulation AS event,
           action_statement AS definition
    FROM information_schema.triggers
    WHERE event_object_table IN ('orders', 'order_items');
  `);
  console.log(res.rows);
  pool.end();
}
run();
