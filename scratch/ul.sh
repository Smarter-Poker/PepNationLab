#!/bin/bash
# Usage: ./scratch/ul.sh <abs_path_to_jpg> <slug>
# Example: ./scratch/ul.sh /path/to/image.jpg retatrutide-rt10
set -e
SRC="$1"
SLUG="$2"
PNG="${SRC%.jpg}.png"
sips -s format png "$SRC" --out "$PNG" > /dev/null 2>&1
cd /Users/smarter.poker/Documents/pepnationlab
node -e "
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const buf = fs.readFileSync('$PNG');
sb.storage.from('print-labels').upload('$SLUG.png', buf, {contentType:'image/png',upsert:true}).then(({error}) => {
  if (error) { console.error('FAIL $SLUG:', error.message); process.exit(1); }
  console.log('✅ $SLUG');
});
"
