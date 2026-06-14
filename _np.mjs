import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL,ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:env.TEST_ADMIN_EMAIL,password:env.TEST_ADMIN_PASSWORD})});
const s=await r.json();const ref=URL.split('//')[1].split('.')[0];const cv='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const ck=`sb-${ref}-auth-token=${cv}`;
const H={cookie:ck,'content-type':'application/json',origin:'https://pepnationlab.com'};
// 1. save events_order_approved=false
const p=await fetch('https://pepnationlab.com/api/account/notifications',{method:'PATCH',headers:H,body:JSON.stringify({events_order_approved:false})});
console.log('PATCH ->',p.status,(await p.text()).slice(0,120).replace(/\n/g,' '));
// 2. read back
const g=await fetch('https://pepnationlab.com/api/account/notifications',{headers:{cookie:ck}});
const gj=await g.json();
console.log('GET ->',g.status,'events_order_approved=',gj.preferences?.events_order_approved,'(expect false if persisted)');
// 3. restore to true
await fetch('https://pepnationlab.com/api/account/notifications',{method:'PATCH',headers:H,body:JSON.stringify({events_order_approved:true})});
const g2=await fetch('https://pepnationlab.com/api/account/notifications',{headers:{cookie:ck}});
console.log('after restore ->',(await g2.json()).preferences?.events_order_approved,'(expect true)');
