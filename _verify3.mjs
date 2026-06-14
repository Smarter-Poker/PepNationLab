import { chromium } from 'playwright';
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL,ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:env.TEST_ADMIN_EMAIL,password:env.TEST_ADMIN_PASSWORD})});
const s=await r.json();const ref=URL.split('//')[1].split('.')[0];const uid=s.user?.id;
const cv='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const nm=`sb-${ref}-auth-token`,domain='pepnationlab.com',cookies=[];
if(cv.length>3180){for(let i=0;i*3180<cv.length;i++)cookies.push({name:`${nm}.${i}`,value:cv.slice(i*3180,(i+1)*3180),domain,path:'/',secure:true,sameSite:'Lax'});}else cookies.push({name:nm,value:cv,domain,path:'/',secure:true,sameSite:'Lax'});
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:360,height:780},isMobile:true});await ctx.addInitScript((uid)=>{try{localStorage.setItem('pnl_firstrun_notif_'+uid,'1');localStorage.setItem('pnl_disclaimer_v1.0','true')}catch(e){}},uid);await ctx.addCookies(cookies);const p=await ctx.newPage();
// 1. footer \n check on /about
await p.goto('https://pepnationlab.com/about',{waitUntil:'domcontentloaded',timeout:25000});await p.waitForTimeout(1500);
const foot=await p.evaluate(()=>{
 const links=[...document.querySelectorAll('footer a')].map(a=>(a.innerText||'').trim());
 const hasBackslashN=links.some(t=>t.includes('\\n'))|| (document.querySelector('footer')||{innerText:''}).innerText.includes('\\n');
 return {sampleLinks:links.slice(0,5),hasLiteralBackslashN:hasBackslashN};
});
console.log('FOOTER:',JSON.stringify(foot));
// 2. chips on /research/by-class
await p.goto('https://pepnationlab.com/research/by-class',{waitUntil:'domcontentloaded',timeout:25000});await p.waitForTimeout(1800);
const chips=await p.evaluate(()=>{
 const iw=innerWidth;const over=document.documentElement.scrollWidth-iw;
 const tabs=[...document.querySelectorAll('[role=tab]')].map(t=>Math.round(t.getBoundingClientRect().width));
 const maxChip=Math.max(0,...tabs);
 const labelSpans=[...document.querySelectorAll('[role=tab] span')].map(s=>Math.round(s.getBoundingClientRect().width)).filter(w=>w>0);
 return {over,tabCount:tabs.length,maxChipWidth:maxChip,maxLabelSpan:Math.max(0,...labelSpans)};
});
console.log('CHIPS:',JSON.stringify(chips));
await b.close();
