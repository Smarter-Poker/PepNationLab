const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envs = fs.readFileSync('.env.local', 'utf8').split('\n');
let url = '', key = '';
envs.forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);
const savageId = '844dca4b-6f01-4779-bc95-bfa1e0809c0c';

async function run() {
  // The logo is already uploaded (we can see it in logo_url) - let's use it
  // logo_url = "https://ydsaqnnuwyvtyxgvrnys.supabase.co/storage/v1/object/public/storefront-assets/844dca4b-6f01-4779-bc95-bfa1e0809c0c/logo-1783892352326.png"
  
  const existingLogoUrl = "https://ydsaqnnuwyvtyxgvrnys.supabase.co/storage/v1/object/public/storefront-assets/844dca4b-6f01-4779-bc95-bfa1e0809c0c/logo-1783892352326.png";

  // Now set custom_branding on the agent_profiles row
  const customBranding = {
    brand_name: "Savage Brands",
    logo_url: existingLogoUrl,
    storefront_heading: "Savage Brands Research Store"
  };

  const { data, error } = await supabase
    .from('agent_profiles')
    .update({ custom_branding: customBranding })
    .eq('id', savageId)
    .select('id, slug, display_name, logo_url, custom_branding');

  if (error) { console.error('Update error:', error); return; }
  console.log('Updated:', JSON.stringify(data, null, 2));
}
run();
