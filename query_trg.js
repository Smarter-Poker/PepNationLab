const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.rpc('get_function_def', { fn_name: 'enforce_researcher_agent_binding' }).maybeSingle();
  console.log(data);
}
run();
