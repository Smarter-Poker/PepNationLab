import { chromium, devices } from 'playwright';
const iphone = devices['iPhone 12'];
const b = await chromium.launch();
const ctx = await b.newContext({ ...iphone });
const p = await ctx.newPage();
const out = [];
async function measure(name){
  await p.waitForTimeout(1200);
  const data = await p.evaluate(()=>{
    const vh = window.innerHeight;
    const navs=[...document.querySelectorAll('nav')].map(n=>({pos:getComputedStyle(n).position,bottom:getComputedStyle(n).bottom,top:Math.round(n.getBoundingClientRect().top),disp:getComputedStyle(n).display}));
    const nav = [...document.querySelectorAll('nav')].find(n=>getComputedStyle(n).position==='fixed' && getComputedStyle(n).display!=='none' && (getComputedStyle(n).bottom==='0px'));
    const navTop = nav ? nav.getBoundingClientRect().top : null;
    const all=[...document.querySelectorAll('button,a.btn,.btn,[type=submit]')];
    const btns = all.map(el=>({t:(el.innerText||el.getAttribute('aria-label')||'').trim().slice(0,28), r:el.getBoundingClientRect(), vis: el.offsetParent!==null||getComputedStyle(el).position==='fixed'}))
      .filter(o=>o.t && /sign in|submit|add to cart|continue|create|save|checkout|place order|apply|next|add to/i.test(o.t) && o.vis);
    const covered = btns.filter(o=> navTop!=null && o.r.bottom > navTop+1 && o.r.top < vh && o.r.height>0).map(o=>o.t+'(b'+Math.round(o.r.bottom)+'>nav'+Math.round(navTop)+')');
    return { vh, navTop, navs, bodyPadBottom: getComputedStyle(document.body).paddingBottom, matchBtns: btns.map(x=>x.t), covered };
  }).catch(e=>({err:e.message}));
  out.push(name+': '+JSON.stringify(data));
}
async function go(url,name){
  await p.goto(url,{waitUntil:'networkidle',timeout:30000}).catch(e=>out.push(name+' navErr '+e.message));
  await measure(name);
  await p.screenshot({ path:'/tmp/'+name+'.png', fullPage:false });
}
await go('https://pepnationlab.com/savagebrands','storefront');
// try clicking first product-ish overlay button to reveal add-to-cart
await go('https://pepnationlab.com/research/a-z','research_az');
await go('https://pepnationlab.com/become-agent','become_agent');
await go('https://pepnationlab.com/about','about');
console.log(out.join('\n\n'));
await b.close();
