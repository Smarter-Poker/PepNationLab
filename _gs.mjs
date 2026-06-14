import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL,ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:env.TEST_ADMIN_EMAIL,password:env.TEST_ADMIN_PASSWORD})});
const s=await r.json();const ref=URL.split('//')[1].split('.')[0];const cv='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const ck=`sb-${ref}-auth-token=${cv}`;
const res=await fetch('https://pepnationlab.com/api/admin/global-search?scope=transactions&q=REFUND',{headers:{cookie:ck}});
const j=await res.json();
console.log('status',res.status,'| transactions returned:',(j.transactions||[]).length);
if(j.transactions&&j.transactions[0]) console.log('sample:',JSON.stringify(j.transactions[0]).slice(0,160));
