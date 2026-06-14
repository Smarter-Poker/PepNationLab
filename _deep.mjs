import { chromium } from 'playwright';
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL,ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:env.TEST_ADMIN_EMAIL,password:env.TEST_ADMIN_PASSWORD})});
const s=await r.json();const ref=URL.split('//')[1].split('.')[0];const uid=s.user?.id;
const cv='base64-'+Buffer.from(JSON.stringify(s)).toString('base64');const nm=`sb-${ref}-auth-token`,domain='pepnationlab.com',cookies=[];
if(cv.length>3180){for(let i=0;i*3180<cv.length;i++)cookies.push({name:`${nm}.${i}`,value:cv.slice(i*3180,(i+1)*3180),domain,path:'/',secure:true,sameSite:'Lax'});}else cookies.push({name:nm,value:cv,domain,path:'/',secure:true,sameSite:'Lax'});
const W=parseInt(process.env.W||'360');
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:W,height:parseInt(process.env.H||"780")},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'});
await ctx.addCookies(cookies);
await ctx.addInitScript((uid)=>{try{localStorage.setItem('pnl_firstrun_notif_'+uid,'1');localStorage.setItem('pnl-theme','dark');}catch(e){}},uid);
const p=await ctx.newPage();const F=process.env.OUT||'/tmp/deep.out';
const urls=fs.readFileSync('/tmp/urls.txt','utf8').trim().split('\n');
const start=parseInt(process.env.START||'0'),count=parseInt(process.env.COUNT||'999');
for(const path of urls.slice(start,start+count)){
 try{
  await p.goto('https://pepnationlab.com'+path,{waitUntil:'domcontentloaded',timeout:18000});
  await p.waitForTimeout(700); await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight)); await p.waitForTimeout(350);
  const d=await p.evaluate(()=>{
   const iw=window.innerWidth, vh=window.innerHeight;
   const over=document.documentElement.scrollWidth-iw;
   const inFixed=(e)=>{let n=e;while(n&&n!==document.body){if(getComputedStyle(n).position==='fixed')return true;n=n.parentElement;}return false;};
   const onscreen=(r)=>r.width>0&&r.height>0&&r.right>2&&r.left<iw-2&&r.bottom>2&&r.top<vh-2;
   const ints=[...document.querySelectorAll('button,a,input,textarea,select,[role=button]')].filter(e=>e.offsetParent!==null&&!inFixed(e));
   const scrollReach=(e)=>{let n=e.parentElement;while(n&&n!==document.body){const c=getComputedStyle(n);if(c.overflowX==='auto'||c.overflowX==='scroll')return true;n=n.parentElement;}return false;};
   const hclip=ints.filter(e=>!scrollReach(e)).map(e=>({t:(e.innerText||e.getAttribute('aria-label')||e.tagName).trim().slice(0,16),r:e.getBoundingClientRect()})).filter(o=>o.r.width>0&&o.r.left>=-1&&o.r.left<iw&&o.r.right>iw+2).map(o=>o.t+'@'+Math.round(o.r.right));
   const nav=[...document.querySelectorAll('nav')].find(n=>getComputedStyle(n).position==='fixed'&&getComputedStyle(n).display!=='none'&&getComputedStyle(n).bottom==='0px');
   const navTop=nav?nav.getBoundingClientRect().top:null;
   const covered=navTop!=null?ints.map(e=>({t:(e.innerText||'').trim().slice(0,18),r:e.getBoundingClientRect()})).filter(o=>onscreen(o.r)&&o.r.width>40&&o.t&&o.r.left>=0&&o.r.left<iw&&o.r.top<navTop&&o.r.bottom>navTop+4).map(o=>o.t).slice(0,4):[];
   const vclip=[...document.querySelectorAll('*')].filter(e=>{if(inFixed(e))return false;const st=getComputedStyle(e);if(!(st.overflowY==='hidden'||st.overflow==='hidden'))return false;if(e.scrollHeight-e.clientHeight<10)return false;if(e.clientHeight<48)return false;const r=e.getBoundingClientRect();if(!onscreen(r))return false;return e.querySelector('button,a,input,select,textarea');}).slice(0,3).map(e=>(e.className||e.tagName).toString().slice(0,22)+'(sh'+e.scrollHeight+'>ch'+e.clientHeight+')');
   return {over,hclip,covered,vclip,redir:location.pathname};
  });
  const issues=[];
  if(d.over>2)issues.push('OVERFLOW='+d.over);
  if(d.hclip.length)issues.push('HCLIP='+JSON.stringify(d.hclip));
  if(d.covered.length)issues.push('NAVCOVER='+JSON.stringify(d.covered));
  if(d.vclip.length)issues.push('VCLIP='+JSON.stringify(d.vclip));
  fs.appendFileSync(F,`[${W}] ${path}  ${issues.length?issues.join(' '):'OK'}\n`);
 }catch(e){fs.appendFileSync(F,`[${W}] ${path}  ERR ${e.message.slice(0,38)}\n`);}
}
await b.close();
