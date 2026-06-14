import { chromium } from 'playwright';
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL,ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:env.TEST_ADMIN_EMAIL,password:env.TEST_ADMIN_PASSWORD})});
const s=await r.json();const ref=URL.split('//')[1].split('.')[0];const uid=s.user?.id;
const cv='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const nm=`sb-${ref}-auth-token`,domain='pepnationlab.com',cookies=[];
if(cv.length>3180){for(let i=0;i*3180<cv.length;i++)cookies.push({name:`${nm}.${i}`,value:cv.slice(i*3180,(i+1)*3180),domain,path:'/',secure:true,sameSite:'Lax'});}else cookies.push({name:nm,value:cv,domain,path:'/',secure:true,sameSite:'Lax'});
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:360,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true});
await ctx.addInitScript((uid)=>{try{localStorage.setItem('pnl_firstrun_notif_'+uid,'1');localStorage.setItem('pnl_disclaimer_v1.0','true')}catch(e){}},uid);
await ctx.addCookies(cookies);const p=await ctx.newPage();
async function measureModal(name){
 await p.waitForTimeout(900);
 const d=await p.evaluate(()=>{
  const iw=innerWidth,vh=innerHeight;
  // topmost fixed overlay (z-index high)
  const fixedEls=[...document.querySelectorAll('*')].filter(e=>{const c=getComputedStyle(e);return c.position==='fixed'&&parseInt(c.zIndex||0)>=100&&e.getBoundingClientRect().width>200&&e.getBoundingClientRect().height>200&&c.display!=='none';});
  if(!fixedEls.length)return {modal:false};
  const overlay=fixedEls.sort((a,b)=>parseInt(getComputedStyle(b).zIndex||0)-parseInt(getComputedStyle(a).zIndex||0))[0];
  // any element inside overlay overflowing right
  const over=[...overlay.querySelectorAll('*')].map(e=>e.getBoundingClientRect()).filter(r=>r.width>0&&r.right>iw+2&&r.left<iw).length;
  // action buttons inside overlay below the fold or covered
  const btns=[...overlay.querySelectorAll('button,a,[role=button],input,select')].filter(e=>e.offsetParent!==null||getComputedStyle(e).position==='fixed');
  const belowFold=btns.map(e=>({t:(e.innerText||e.tagName).trim().slice(0,14),r:e.getBoundingClientRect()})).filter(o=>o.r.height>0&&o.r.top>=vh-2).map(o=>o.t);
  const rightClip=btns.map(e=>({t:(e.innerText||e.tagName).trim().slice(0,14),r:e.getBoundingClientRect()})).filter(o=>o.r.width>0&&o.r.right>iw+2&&o.r.left<iw).map(o=>o.t+'@'+Math.round(o.r.right));
  const ob=overlay.getBoundingClientRect();
  return {modal:true,overlayZ:getComputedStyle(overlay).zIndex,overlayBox:[Math.round(ob.width),Math.round(ob.height)],hOverElems:over,btnRightClip:[...new Set(rightClip)],btnBelowFold:[...new Set(belowFold)].slice(0,6)};
 });
 console.log('### '+name+': '+JSON.stringify(d));
 await p.screenshot({path:'/sessions/nice-modest-mayer/mnt/outputs/m_'+name+'.png'}).catch(()=>{});
}
// 1. Help Me Choose wizard on /research/catalog
await p.goto('https://pepnationlab.com/research/catalog',{waitUntil:'domcontentloaded',timeout:25000});await p.waitForTimeout(1800);
const clicked=await p.evaluate(()=>{const a=document.querySelector('aside');if(!a)return 'no aside';const btn=a.querySelector('button');if(btn){btn.click();return 'clicked aside btn';}return 'no aside btn';});
console.log('wizard trigger:',clicked);
await measureModal('wizard');
await b.close();
