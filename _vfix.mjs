import { chromium } from 'playwright';
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL,ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:env.TEST_ADMIN_EMAIL,password:env.TEST_ADMIN_PASSWORD})});
const s=await r.json();const ref=URL.split('//')[1].split('.')[0];const uid=s.user?.id;
const cv='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const nm=`sb-${ref}-auth-token`,domain='pepnationlab.com',cookies=[];
if(cv.length>3180){for(let i=0;i*3180<cv.length;i++)cookies.push({name:`${nm}.${i}`,value:cv.slice(i*3180,(i+1)*3180),domain,path:'/',secure:true,sameSite:'Lax'});}else cookies.push({name:nm,value:cv,domain,path:'/',secure:true,sameSite:'Lax'});
const CSS=fs.readFileSync('app/globals-mobile-fit.css','utf8');
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:360,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'});
await ctx.addInitScript((uid)=>{try{localStorage.setItem('pnl_firstrun_notif_'+uid,'1');localStorage.setItem('pnl_disclaimer_v1.0','true')}catch(e){}},uid);
await ctx.addCookies(cookies);const p=await ctx.newPage();const F='/tmp/vfix.out';
async function measure(){return await p.evaluate(()=>{
 const iw=innerWidth,vh=innerHeight;const over=document.documentElement.scrollWidth-iw;
 const inFixed=(e)=>{let n=e;while(n&&n!==document.body){if(getComputedStyle(n).position==='fixed')return true;n=n.parentElement;}return false;};
 const scrollReach=(e)=>{let n=e.parentElement;while(n&&n!==document.body){const c=getComputedStyle(n);if(c.overflowX==='auto'||c.overflowX==='scroll')return true;n=n.parentElement;}return false;};
 const onscreen=(r)=>r.width>0&&r.height>0&&r.right>2&&r.left<iw-2&&r.bottom>2&&r.top<vh-2;
 const ints=[...document.querySelectorAll('button,a,input,textarea,select,[role=button]')].filter(e=>e.offsetParent!==null&&!inFixed(e));
 const hclip=ints.filter(e=>!scrollReach(e)).map(e=>({t:(e.innerText||e.tagName).trim().slice(0,14),r:e.getBoundingClientRect()})).filter(o=>o.r.width>0&&o.r.left>=-1&&o.r.left<iw&&o.r.right>iw+2).map(o=>o.t+'@'+Math.round(o.r.right));
 const nav=[...document.querySelectorAll('nav')].find(n=>getComputedStyle(n).position==='fixed'&&getComputedStyle(n).display!=='none'&&getComputedStyle(n).bottom==='0px');
 const navTop=nav?nav.getBoundingClientRect().top:null;
 const cover=navTop!=null?ints.map(e=>({t:(e.innerText||'').trim().slice(0,14),r:e.getBoundingClientRect()})).filter(o=>onscreen(o.r)&&o.r.width>40&&o.t&&o.r.left>=0&&o.r.left<iw&&o.r.top<navTop&&o.r.bottom>navTop+4).map(o=>o.t).slice(0,3):[];
 return {over,hclip:[...new Set(hclip)].slice(0,5),cover};
});}
for(const path of process.argv.slice(2)){
 try{
  await p.goto('https://pepnationlab.com'+path,{waitUntil:'domcontentloaded',timeout:18000});await p.waitForTimeout(700);
  await p.addStyleTag({content:CSS});
  await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(400);
  const a=await measure();
  const iss=[];if(a.over>2)iss.push('OVER='+a.over);if(a.hclip.length)iss.push('HCLIP='+JSON.stringify(a.hclip));if(a.cover.length)iss.push('COVER='+JSON.stringify(a.cover));
  fs.appendFileSync(F,`${path}  ${iss.length?iss.join(' '):'FIXED-OK'}\n`);
 }catch(e){fs.appendFileSync(F,`${path}  ERR ${e.message.slice(0,30)}\n`);}
}
await b.close();
