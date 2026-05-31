const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgres://postgres.ydsaqnnuwyvtyxgvrnys:M47pyCSGggSXlepDyiQaqEcU2Q3BjLHjR6p6Zqo6gqI@aws-0-us-west-1.pooler.supabase.com:6543/postgres'
});
async function run() {
  await client.connect();
  const res = await client.query(`SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime'`);
  console.log(res.rows);
  await client.end();
}
run().catch(console.error);
