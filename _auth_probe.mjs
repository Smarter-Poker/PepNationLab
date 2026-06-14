import { chromium, devices } from 'playwright';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const URL=env.NEXT_PUBLIC_SUPABASE_URL, ANON=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email=env.TEST_ADMIN_EMAIL, password=env.TEST_ADMIN_PASSWORD;
// 1. password grant
const r = await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{'apikey':ANON,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
const session = await r.json();
if(!session.access_token){ console.log('AUTH FAIL', JSON.stringify(session).slice(0,300)); process.exit(1); }
const ref = URL.split('//')[1].split('.')[0];
const cookieName = `sb-${ref}-auth-token`;
const cookieVal = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64');
const iphone = devices['iPhone 12'];
const b = await chromium.launch();
const ctx = await b.newContext({ ...iphone });
// chunk cookie if needed (supabase ssr splits >3180 chars into .0/.1). Try single first.
const domain='pepnationlab.com';
const cookies=[];
if(cookieVal.length>3180){
  for(let i=0;i*3180<cookieVal.length;i++) cookies.push({name:`${cookieName}.${i}`,value:cookieVal.slice(i*3180,(i+1)*3180),domain,path:'/',secure:true,sameSite:'Lax'});
} else cookies.push({name:cookieName,value:cookieVal,domain,path:'/',secure:true,sameSite:'Lax'});
await ctx.addCookies(cookies);
const p = await ctx.newPage();
const out=[];
async function go(url,name){
  await p.goto(url,{waitUntil:'networkidle',timeout:35000}).catch(e=>out.push(name+' navErr '+e.message));
  await p.waitForTimeout(1500);
  const data = await p.evaluate(()=>{
    const vh=window.innerHeight;
    const nav=[...document.querySelectorAll('nav')].find(n=>getComputedStyle(n).position==='fixed'&&getComputedStyle(n).display!=='none'&&getComputedStyle(n).bottom==='0px');
    const navTop=nav?Math.round(nav.getBoundingClientRect().top):null;
    const url=location.pathname;
    // find fixed/sticky bottom bars
    const bars=[...document.querySelectorAll('*')].filter(el=>{const s=getComputedStyle(el);return (s.position==='fixed'||s.position==='sticky')&&s.bottom==='0px'&&el.offsetHeight>0&&el.offsetWidth>200;}).slice(0,6).map(el=>({tag:el.tagName,cls:(el.className||'').toString().slice(0,30),z:getComputedStyle(el).zIndex,top:Math.round(el.getBoundingClientRect().top),h:el.offsetHeight}));
    const btns=[...document.querySelectorAll('button,a.btn,.btn,[type=submit]')].map(el=>({t:(el.innerText||'').trim().slice(0,24),r:el.getBoundingClientRect(),vis:el.offsetParent!==null}))
      .filter(o=>o.t&&/submit|add to cart|checkout|place order|save|create|continue|update|send|confirm|pay/i.test(o.t)&&o.vis);
    const covered=btns.filter(o=>navTop!=null&&o.r.bottom>navTop+1&&o.r.top<vh&&o.r.height>0).map(o=>o.t+'(b'+Math.round(o.r.bottom)+')');
    const belowFold=btns.filter(o=>o.r.top>=vh).map(o=>o.t);
    return {url,vh,navTop,bottomBars:bars,covered,belowFold,btns:btns.slice(0,8).map(x=>x.t)};
  }).catch(e=>({err:e.message}));
  out.push(name+': '+JSON.stringify(data));
  await p.screenshot({path:'/tmp/'+name+'.png'}).catch(()=>{});
}
await go('https://pepnationlab.com/dashboard','dashboard');
await go('https://pepnationlab.com/checkout','checkout');
await go('https://pepnationlab.com/admin/products/new','admin_prod_new');
await go('https://pepnationlab.com/account/change-password','change_pw');
await go('https://pepnationlab.com/admin/settings','admin_settings');
console.log(out.join('\n\n'));
await b.close();
