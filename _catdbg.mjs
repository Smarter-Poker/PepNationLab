import { chromium } from 'playwright';
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL,ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:env.TEST_ADMIN_EMAIL,password:env.TEST_ADMIN_PASSWORD})});
const s=await r.json();const ref=URL.split('//')[1].split('.')[0];const uid=s.user?.id;
const cv='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const nm=`sb-${ref}-auth-token`,domain='pepnationlab.com',cookies=[];
if(cv.length>3180){for(let i=0;i*3180<cv.length;i++)cookies.push({name:`${nm}.${i}`,value:cv.slice(i*3180,(i+1)*3180),domain,path:'/',secure:true,sameSite:'Lax'});}else cookies.push({name:nm,value:cv,domain,path:'/',secure:true,sameSite:'Lax'});
const CSS=fs.readFileSync('app/globals-mobile-fit.css','utf8');
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:360,height:780},isMobile:true});await ctx.addInitScript((uid)=>{try{localStorage.setItem('pnl_firstrun_notif_'+uid,'1');localStorage.setItem('pnl_disclaimer_v1.0','true')}catch(e){}},uid);await ctx.addCookies(cookies);const p=await ctx.newPage();
await p.goto('https://pepnationlab.com/research/catalog',{waitUntil:'domcontentloaded',timeout:20000});await p.waitForTimeout(1500);
await p.addStyleTag({content:CSS});await p.waitForTimeout(500);
const o=await p.evaluate(()=>{
 const aside=document.querySelector('aside');
 const main=aside?aside.parentElement.querySelector('main'):null;
 const row=aside?aside.parentElement:null;
 const grid=[...document.querySelectorAll('*')].find(e=>getComputedStyle(e).display==='grid'&&getComputedStyle(e).gridTemplateColumns.includes('px')&&e.querySelector('button'));
 const f=(e)=>e?{w:Math.round(e.getBoundingClientRect().width),x:Math.round(e.getBoundingClientRect().x)}:null;
 return {
  rowFlexWrap:row?getComputedStyle(row).flexWrap:null, rowDisplay:row?getComputedStyle(row).display:null, row:f(row),
  asideFlex:aside?getComputedStyle(aside).flex:null, aside:f(aside),
  main:f(main), mainFlex:main?getComputedStyle(main).flex:null,
  grid:grid?{cols:getComputedStyle(grid).gridTemplateColumns,box:f(grid)}:null
 };
});
console.log(JSON.stringify(o,null,1));
await b.close();
