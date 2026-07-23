const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sql = fs.readFileSync('/Users/smarter.poker/Documents/pepnationlab/supabase/migrations/20260712150000_signup_referral_and_promos.sql', 'utf8');

// Use Postgres directly via psql since Supabase JS doesn't support executing raw arbitrary SQL DDL
