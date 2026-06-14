import { chromium, devices } from 'playwright';
const iphone = devices['iPhone 12'];
const b = await chromium.launch();
const ctx = await b.newContext({ ...iphone });
const p = await ctx.newPage();
const out = [];
async function probe(url, name){
  await p.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(e=>out.push(name+' nav err '+e.message));
  await p.waitForTimeout(1500);
  // measure: does any submit/primary button sit under the fixed bottom nav?
  const data = await p.evaluate(()=>{
    const vh = window.innerHeight;
    const nav = document.querySelector('nav.mobile-only-flex') || [...document.querySelectorAll('nav')].find(n=>getComputedStyle(n).position==='fixed' && parseInt(getComputedStyle(n).bottom||'999')===0);
    const navTop = nav ? nav.getBoundingClientRect().top : null;
    const btns = [...document.querySelectorAll('button, a.btn, .btn, [type=submit]')]
      .map(el=>({t:(el.innerText||'').trim().slice(0,24), r:el.getBoundingClientRect()}))
      .filter(o=>o.t && /sign in|submit|add to cart|continue|create|save|checkout|place order|apply|next/i.test(o.t));
    const covered = btns.filter(o=> navTop!=null && o.r.bottom > navTop && o.r.top < vh).map(o=>o.t);
    const belowFold = btns.filter(o=> o.r.top > vh).map(o=>o.t);
    return { vh, navTop, btns: btns.map(b=>b.t+' bottom='+Math.round(b.r.bottom)), covered, belowFold,
      bodyPadBottom: getComputedStyle(document.body).paddingBottom };
  }).catch(e=>({err:e.message}));
  out.push(name+': '+JSON.stringify(data));
  await p.screenshot({ path: '/tmp/'+name+'.png' });
}
await probe('https://pepnationlab.com/login','login');
console.log(out.join('\n'));
await b.close();
