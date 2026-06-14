import { chromium } from 'playwright';
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL,ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:env.TEST_ADMIN_EMAIL,password:env.TEST_ADMIN_PASSWORD})});
const s=await r.json();const ref=URL.split('//')[1].split('.')[0];const uid=s.user?.id;
const cv='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const nm=`sb-${ref}-auth-token`,domain='pepnationlab.com',cookies=[];
if(cv.length>3180){for(let i=0;i*3180<cv.length;i++)cookies.push({name:`${nm}.${i}`,value:cv.slice(i*3180,(i+1)*3180),domain,path:'/',secure:true,sameSite:'Lax'});}else cookies.push({name:nm,value:cv,domain,path:'/',secure:true,sameSite:'Lax'});
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:375,height:780},isMobile:true});await ctx.addInitScript((uid)=>{try{localStorage.setItem('pnl_firstrun_notif_'+uid,'1');localStorage.setItem('pnl_disclaimer_v1.0','true')}catch(e){}},uid);await ctx.addCookies(cookies);const p=await ctx.newPage();const F='/tmp/ux.out';
for(const path of process.argv.slice(2)){
 try{
  await p.goto('https://pepnationlab.com'+path,{waitUntil:'domcontentloaded',timeout:18000});await p.waitForTimeout(900);
  const d=await p.evaluate(()=>{
   const vis=(e)=>e.offsetParent!==null&&e.getBoundingClientRect().width>0;
   const ints=[...document.querySelectorAll('button,a,[role=button],input[type=checkbox],input[type=radio]')].filter(vis);
   const tiny=ints.filter(e=>{const r=e.getBoundingClientRect();return (r.height<34||r.width<28)&&r.height>0&&(e.innerText||'').trim().length<30;}).map(e=>({t:(e.innerText||e.getAttribute('aria-label')||e.tagName).trim().slice(0,14),h:Math.round(e.getBoundingClientRect().height),w:Math.round(e.getBoundingClientRect().width)}));
   // tiny fonts
   const txt=[...document.querySelectorAll('p,span,a,button,label,td,div,li')].filter(vis).filter(e=>e.children.length===0&&(e.innerText||'').trim().length>1);
   const small=txt.filter(e=>parseFloat(getComputedStyle(e).fontSize)<11).map(e=>parseFloat(getComputedStyle(e).fontSize)).sort((a,b)=>a-b);
   const cnt={};tiny.forEach(t=>{cnt[t.h+'x'+t.w]=(cnt[t.h+'x'+t.w]||0)+1;});
   return {tinyCount:tiny.length,tinySample:tiny.slice(0,5),smallFontCount:small.length,minFont:small[0]||null};
  });
  fs.appendFileSync(F,`${path}  tinyTargets=${d.tinyCount} ${JSON.stringify(d.tinySample)}  smallFonts=${d.smallFontCount}(min ${d.minFont})\n`);
 }catch(e){fs.appendFileSync(F,`${path}  ERR ${e.message.slice(0,30)}\n`);}
}
await b.close();
