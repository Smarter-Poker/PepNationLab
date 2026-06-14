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
 await p.waitForTimeout(1200);
 const d=await p.evaluate(()=>{
  const iw=innerWidth,vh=innerHeight;
  const fixedEls=[...document.querySelectorAll('*')].filter(e=>{const c=getComputedStyle(e);return c.position==='fixed'&&parseInt(c.zIndex||0)>=100&&e.getBoundingClientRect().width>200&&e.getBoundingClientRect().height>200&&c.display!=='none';});
  if(!fixedEls.length)return {modal:false};
  const overlay=fixedEls.sort((a,b)=>parseInt(getComputedStyle(b).zIndex||0)-parseInt(getComputedStyle(a).zIndex||0))[0];
  const over=[...overlay.querySelectorAll('*')].map(e=>e.getBoundingClientRect()).filter(r=>r.width>0&&r.right>iw+2&&r.left<iw).length;
  const ob=overlay.getBoundingClientRect();
  const btns=[...overlay.querySelectorAll('button,a,[role=button]')].filter(e=>e.offsetParent!==null||getComputedStyle(e).position==='fixed');
  const rclip=btns.map(e=>e.getBoundingClientRect()).filter(r=>r.width>0&&r.right>iw+2).length;
  return {modal:true,z:getComputedStyle(overlay).zIndex,box:[Math.round(ob.width),Math.round(ob.height)],coversViewport:ob.height>=vh-4&&ob.width>=iw-4,hOver:over,btnRClip:rclip};
 });
 console.log('### '+name+': '+JSON.stringify(d));
 await p.screenshot({path:'/sessions/nice-modest-mayer/mnt/outputs/m_'+name+'.png'}).catch(()=>{});
}
// QuickView on catalog
await p.goto('https://pepnationlab.com/research/catalog',{waitUntil:'domcontentloaded',timeout:25000});await p.waitForTimeout(2000);
const c1=await p.evaluate(()=>{const main=document.querySelector('main');if(!main)return 'no main';const card=main.querySelector('a[href*="/research/"],[role=button],button');if(card){card.click();return 'clicked '+card.tagName;}return 'no card';});
console.log('quickview trigger:',c1);await measureModal('quickview');
// dismiss + go to references for IframeModal
await p.goto('https://pepnationlab.com/research/5-amino-1mq/references',{waitUntil:'domcontentloaded',timeout:25000});await p.waitForTimeout(1800);
const c2=await p.evaluate(()=>{const el=document.querySelector('[data-inapp],a[href*="pubmed"],a[href*="doi"],a[target="_blank"],button[onclick]');
 const cands=[...document.querySelectorAll('button,a')].filter(e=>/view|read|source|reference|pubmed|full/i.test(e.innerText||e.getAttribute('aria-label')||''));
 const t=el||cands[0];if(t){t.click();return 'clicked '+(t.innerText||t.tagName).slice(0,20);}return 'no ref link';});
console.log('iframe trigger:',c2);await measureModal('iframe');
await b.close();
