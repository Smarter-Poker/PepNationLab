import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'savagebrands@pepnationlab.com',
    password: 'Pepnation123!'
  });
  
  if (error) { console.error("Login failed:", error.message); return; }
  
  const cookieString = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token=${encodeURIComponent(JSON.stringify([data.session.access_token, data.session.refresh_token, null, null, null]))}`;
  
  console.log("Fetching /savagebrands...");
  const res = await fetch('http://localhost:3000/savagebrands', {
    headers: { 'Cookie': cookieString, 'User-Agent': 'curl/8.7.1' }
  });
  
  const text = await res.text();
  console.log("Response status:", res.status);
  
  if (text.includes('Unexpected error') || text.includes('Error:') || res.status === 500) {
    console.log("Error found!");
  } else {
    console.log("Page loaded successfully.");
  }
}
run();
