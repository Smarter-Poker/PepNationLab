import { chromium } from 'playwright';
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL,ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:env.TEST_ADMIN_EMAIL,password:env.TEST_ADMIN_PASSWORD})});
const s=await r.json();const ref=URL.split('//')[1].split('.')[0];const uid=s.user?.id;
const cv='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const nm=`sb-${ref}-auth-token`,domain='pepnationlab.com',cookies=[];
if(cv.length>3180){for(let i=0;i*3180<cv.length;i++)cookies.push({name:`${nm}.${i}`,value:cv.slice(i*3180,(i+1)*3180),domain,path:'/',secure:true,sameSite:'Lax'});}else cookies.push({name:nm,value:cv,domain,path:'/',secure:true,sameSite:'Lax'});
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1280,height:900}});
await ctx.addInitScript((uid)=>{try{localStorage.setItem('pnl_firstrun_notif_'+uid,'1');localStorage.setItem('pnl_disclaimer_v1.0','true')}catch(e){}},uid);
await ctx.addCookies(cookies);const p=await ctx.newPage();const F=process.env.OUT||'/tmp/bugs.out';
const urls=fs.readFileSync('/tmp/urls.txt','utf8').trim().split('\n');
const start=parseInt(process.env.START||'0'),count=parseInt(process.env.COUNT||'999');
for(const path of urls.slice(start,start+count)){
 const errs=[],neterr=[],bad=[];
 const onConsole=m=>{if(m.type()==='error'){const t=m.text();if(!/favicon|net::ERR_|Failed to load resource|the server responded/i.test(t)||/TypeError|ReferenceError|is not a function|undefined is not|Cannot read|Minified React/i.test(t))errs.push(t.slice(0,120));}};
 const onPageErr=e=>errs.push('PAGEERROR: '+(e.message||'').slice(0,120));
 const onResp=resp=>{const u=resp.url();const st=resp.status();if(st>=400&&u.includes('/api/')){bad.push(st+' '+u.replace('https://pepnationlab.com','').slice(0,80));}};
 const onReqFail=req=>{const u=req.url();if(u.includes('/api/'))neterr.push('REQFAIL '+u.replace('https://pepnationlab.com','').slice(0,80));};
 p.on('console',onConsole);p.on('pageerror',onPageErr);p.on('response',onResp);
 try{
  await p.goto('https://pepnationlab.com'+path,{waitUntil:'domcontentloaded',timeout:20000});
  await p.waitForTimeout(2200);
 }catch(e){errs.push('NAV: '+e.message.slice(0,50));}
 p.off('console',onConsole);p.off('pageerror',onPageErr);p.off('response',onResp);
 const all=[...new Set([...errs.map(e=>'JS:'+e),...bad.map(e=>'API:'+e)])];
 fs.appendFileSync(F,`${path}\t${all.length?all.join(' || '):'clean'}\n`);
}
await b.close();
