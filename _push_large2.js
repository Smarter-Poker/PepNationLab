const fs = require('fs'); const os = require('os'); const https = require('https');
let TOKEN = process.env.GITHUB_TOKEN;
try { if (!TOKEN) { const c = fs.readFileSync(os.homedir()+'/.git-credentials','utf8'); const m = c.match(/:\/\/(?:[^:@\n]*:)?([^@\n]+)@github\.com/); if (m) TOKEN = m[1]; } } catch(e) {}
if (!TOKEN) { console.error('NO_TOKEN: set GITHUB_TOKEN or ensure ~/.git-credentials has a github.com entry'); process.exit(1); }
const REPO = 'Smarter-Poker/PepNationLab';
const FILES = [
  { path: 'components/research/CalculatorSuite.tsx', want: 'c9c6c8369d24d35e461b0c9ad962bd9823a6e93b', msg: 'fix(calculators): remove emoji pictographs from result text (zero-emoji hard rule)\n\nRemoved U+26A0 / U+26A1 / U+2713 from the stability + cost-compare result text;\nthe existing color coding already conveys severity/positive state.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>' },
  { path: 'app/lab-journal/LabJournalClient.tsx', want: 'ca0ea0b43833b27fc1f09b4ba1b73ba688039a5f', msg: 'fix(lab-journal): roll back optimistic symptom save on failure\n\nsaveSymptom was an optimistic insert with .catch(()=>{}) and no res.ok check,\nleaving a phantom entry that vanished on reload when the POST failed. Now checks\nres.ok and rolls back the insert + restores the inputs on failure.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>' },
];
function api(method, path, body) { return new Promise((res, rej) => { const data = body ? JSON.stringify(body) : null; const r = https.request({ hostname:'api.github.com', path, method, headers:{ 'Authorization':'token '+TOKEN, 'User-Agent':'PNL-Push', 'Accept':'application/vnd.github+json', 'Content-Type':'application/json', ...(data?{'Content-Length':Buffer.byteLength(data)}:{}) } }, (rp) => { let d=''; rp.on('data',c=>d+=c); rp.on('end',()=>{ try{res({status:rp.statusCode, body:JSON.parse(d)});}catch{res({status:rp.statusCode, body:d});} }); }); r.on('error',rej); if(data) r.write(data); r.end(); }); }
(async () => { for (const f of FILES) { try {
  const g = await api('GET', `/repos/${REPO}/contents/${f.path}?ref=main`);
  const sha = g.body && g.body.sha; if (!sha) { console.error('NO_SHA', f.path, g.status); continue; }
  const content = fs.readFileSync(__dirname + '/' + f.path).toString('base64');
  const p = await api('PUT', `/repos/${REPO}/contents/${encodeURI(f.path)}`, { message: f.msg, content, sha, branch: 'main' });
  if (p.body && p.body.content) { const got = p.body.content.sha; console.log('OK', f.path, 'sha='+got, got===f.want?'MATCH':'MISMATCH', 'commit='+(p.body.commit&&p.body.commit.sha)); }
  else { console.error('PUT_FAIL', f.path, p.status, JSON.stringify(p.body).slice(0,300)); }
} catch(e) { console.error('ERR', f.path, String(e)); } } })();
