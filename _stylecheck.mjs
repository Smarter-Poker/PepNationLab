import { chromium } from 'playwright';
const b=await chromium.launch();const p=await(await b.newContext()).newPage();
await p.setContent('<div id="x" style="display:flex;gap:8px"><button>a</button></div>');
const attr=await p.evaluate(()=>document.getElementById('x').getAttribute('style'));
console.log('React-style attr would render similar to:',JSON.stringify(attr));
await b.close();
