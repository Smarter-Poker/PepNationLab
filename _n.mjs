import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL,ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:env.TEST_ADMIN_EMAIL,password:env.TEST_ADMIN_PASSWORD})});
const s=await r.json();const ref=URL.split('//')[1].split('.')[0];const cv='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const ck=`sb-${ref}-auth-token=${cv}`;
const res=await fetch('https://pepnationlab.com/api/account/notifications',{headers:{cookie:ck}});
console.log('GET /api/account/notifications ->',res.status,(await res.text()).slice(0,160).replace(/\n/g,' '));
