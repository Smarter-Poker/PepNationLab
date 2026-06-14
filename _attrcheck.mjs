import { chromium } from 'playwright';
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL,ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:env.TEST_ADMIN_EMAIL,password:env.TEST_ADMIN_PASSWORD})});
const s=await r.json();const ref=URL.split('//')[1].split('.')[0];const uid=s.user?.id;
const cv='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const nm=`sb-${ref}-auth-token`,domain='pepnationlab.com',cookies=[];
if(cv.length>3180){for(let i=0;i*3180<cv.length;i++)cookies.push({name:`${nm}.${i}`,value:cv.slice(i*3180,(i+1)*3180),domain,path:'/',secure:true,sameSite:'Lax'});}else cookies.push({name:nm,value:cv,domain,path:'/',secure:true,sameSite:'Lax'});
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:360,height:780},isMobile:true});await ctx.addInitScript((uid)=>{try{localStorage.setItem('pnl_firstrun_notif_'+uid,'1')}catch(e){}},uid);await ctx.addCookies(cookies);const p=await ctx.newPage();
await p.goto('https://pepnationlab.com/lab-journal',{waitUntil:'domcontentloaded',timeout:20000});await p.waitForTimeout(1300);
const out=await p.evaluate(()=>{
 const styles=[...document.querySelectorAll('[style]')].map(e=>e.getAttribute('style')).filter(s=>s.includes('flex')||s.includes('grid-template'));
 const flexNoSpace=styles.filter(s=>/display:flex/.test(s)).length;
 const flexSpace=styles.filter(s=>/display: flex/.test(s)).length;
 return {sample:styles.slice(0,3),flexNoSpace,flexSpace,total:styles.length};
});
console.log(JSON.stringify(out,null,1));
await b.close();
