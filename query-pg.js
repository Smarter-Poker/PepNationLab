const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
});

async function run() {
  const res = await pool.query(`
    SELECT pg_get_functiondef(oid)
    FROM pg_proc
    WHERE proname = 'deduct_inventory_on_order_approval';
  `);
  console.log(res.rows[0].pg_get_functiondef);
  pool.end();
}
run();
