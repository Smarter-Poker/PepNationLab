import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function dumpCompounds() {
  const { data, error } = await supabase
    .from('compounds')
    .select('slug, display_name, eli5_summary, mechanism')
    .order('slug', { ascending: true });

  if (error) {
    console.error('Error fetching compounds:', error);
    process.exit(1);
  }

  const outputPath = path.join(process.cwd(), 'compounds_dump.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`Dumped ${data.length} compounds to ${outputPath}`);
}

dumpCompounds();
