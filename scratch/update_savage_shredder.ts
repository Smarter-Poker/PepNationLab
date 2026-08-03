import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AGENT_ID = "844dca4b-6f01-4779-bc95-bfa1e0809c0c";
const IMAGE_PATH = '/Users/smarter.poker/.gemini/antigravity/brain/a19f9938-5124-4d98-ab0e-d8f465f94f69/.tempmediaStorage/media_a19f9938-5124-4d98-ab0e-d8f465f94f69_1785457729170.jpg';

async function main() {
  if (!fs.existsSync(IMAGE_PATH)) {
    console.error("Image file not found at", IMAGE_PATH);
    return;
  }
  
  const buffer = fs.readFileSync(IMAGE_PATH);
  const destName = `bundle-images/${AGENT_ID}-shredder-${Date.now()}.jpg`;
  
  console.log("Uploading image...");
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('storefront-assets')
    .upload(destName, buffer, {
      contentType: 'image/jpeg',
      upsert: true
    });
    
  if (uploadError) {
    console.error("Upload failed:", uploadError);
    return;
  }
  
  console.log("Uploaded successfully:", uploadData);
  const newUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/storefront-assets/${destName}`;
  console.log("New URL:", newUrl);
  
  console.log("Fetching agent profile...");
  const { data: profiles, error: fetchError } = await supabase
    .from('agent_profiles')
    .select('bundles_config')
    .eq('id', AGENT_ID)
    .single();
    
  if (fetchError) {
    console.error("Fetch profile failed:", fetchError);
    return;
  }
  
  const bundles = profiles.bundles_config || [];
  let found = false;
  for (const b of bundles) {
    if (b.name === 'Savage Shredder') {
      b.image_url = newUrl;
      b.vial_image_url = newUrl;
      found = true;
      break;
    }
  }
  
  if (!found) {
    console.error("Savage Shredder bundle not found in config.");
    return;
  }
  
  console.log("Updating agent profile with new bundles_config...");
  const { error: updateError } = await supabase
    .from('agent_profiles')
    .update({ bundles_config: bundles })
    .eq('id', AGENT_ID);
    
  if (updateError) {
    console.error("Failed to update profile:", updateError);
  } else {
    console.log("Profile updated successfully!");
  }
}

main();
