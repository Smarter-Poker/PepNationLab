require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query(`
    SELECT event_object_table, trigger_name, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'agent_products';
  `);
  console.log(res.rows);
  pool.end();
}
run();
