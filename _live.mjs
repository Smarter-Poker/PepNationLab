import { chromium } from 'playwright';
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL,ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:env.TEST_ADMIN_EMAIL,password:env.TEST_ADMIN_PASSWORD})});
const s=await r.json();const ref=URL.split('//')[1].split('.')[0];const uid=s.user?.id;
const cv='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const nm=`sb-${ref}-auth-token`,domain='pepnationlab.com',cookies=[];
if(cv.length>3180){for(let i=0;i*3180<cv.length;i++)cookies.push({name:`${nm}.${i}`,value:cv.slice(i*3180,(i+1)*3180),domain,path:'/',secure:true,sameSite:'Lax'});}else cookies.push({name:nm,value:cv,domain,path:'/',secure:true,sameSite:'Lax'});
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:360,height:780},isMobile:true});await ctx.addInitScript((uid)=>{try{localStorage.setItem('pnl_firstrun_notif_'+uid,'1');localStorage.setItem('pnl_disclaimer_v1.0','true')}catch(e){}},uid);await ctx.addCookies(cookies);const p=await ctx.newPage();
for(const path of process.argv.slice(2)){
 await p.goto('https://pepnationlab.com'+path,{waitUntil:'domcontentloaded',timeout:20000});await p.waitForTimeout(1200);
 const d=await p.evaluate(()=>{
  const iw=innerWidth;const over=document.documentElement.scrollWidth-iw;
  const inFixed=(e)=>{let n=e;while(n&&n!==document.body){if(getComputedStyle(n).position==='fixed')return true;n=n.parentElement;}return false;};
  const sr=(e)=>{let n=e.parentElement;while(n&&n!==document.body){const c=getComputedStyle(n);if(c.overflowX==='auto'||c.overflowX==='scroll')return true;n=n.parentElement;}return false;};
  const hclip=[...document.querySelectorAll('button,a,input,select,[role=button]')].filter(e=>e.offsetParent&&!inFixed(e)&&!sr(e)).map(e=>e.getBoundingClientRect()).filter(r=>r.width>0&&r.left>=-1&&r.left<iw&&r.right>iw+2).length;
  const fa=document.querySelector('footer a');const faH=fa?Math.round(fa.getBoundingClientRect().height):null;
  return {over,hclip,footerLinkH:faH};
 });
 console.log(path,JSON.stringify(d));
}
await b.close();
