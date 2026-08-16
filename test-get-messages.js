require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await svc.from('messenger_messages').select('*').not('media_url', 'is', null).limit(1);
  if (error) console.error(error);
  console.log(data);
}
test();
