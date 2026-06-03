import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_first_name := split_part(v_full_name, ' ', 1);
  IF strpos(v_full_name, ' ') > 0 THEN
    v_last_name := substr(v_full_name, strpos(v_full_name, ' ') + 1);
  ELSE
    v_last_name := NULL;
  END IF;

  INSERT INTO profiles (id, email, full_name, first_name, last_name, role)
  VALUES (
    NEW.id,
    CASE WHEN NEW.email LIKE '%@internal.auth' THEN NULL ELSE NEW.email END,
    v_full_name,
    v_first_name,
    v_last_name,
    'pending'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  // We can't run DDL via JS client without an RPC that executes arbitrary SQL.
  // Wait, I can just create a migration file and run it?
}
run();
