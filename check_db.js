require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('products').select('name, unit_size, unit_measure').ilike('name', '%tirzepatide%').limit(3).then(r => console.log(r.data));
