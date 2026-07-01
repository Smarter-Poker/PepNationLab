const fs = require('fs');
const https = require('https');

const TOKEN = process.env.GITHUB_TOKEN || process.argv[2];
if (!TOKEN) {
  console.error('Usage: GITHUB_TOKEN=xxx node .push-asg.js');
  console.error('   or: node .push-asg.js <token>');
  process.exit(1);
}

const content = fs.readFileSync(__dirname + '/components/AgentStorefrontGrid.tsx');
const b64 = content.toString('base64');

const payload = JSON.stringify({
  message: 'Push AgentStorefrontGrid.tsx — real content (199KB)',
  content: b64,
  sha: '76c670d5b562238c643f7239c774e007e88c9ab7',
  branch: 'main'
});

const options = {
  hostname: 'api.github.com',
  path: '/repos/Smarter-Poker/PepNationLab/contents/components/AgentStorefrontGrid.tsx',
  method: 'PUT',
  headers: {
    'Authorization': `token ${TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'PepNationLab-Push',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const parsed = JSON.parse(data);
    if (parsed.commit) {
      console.log('SUCCESS! Commit SHA:', parsed.commit.sha);
      console.log('File SHA:', parsed.content.sha);
      console.log('File size:', parsed.content.size);
    } else {
      console.error('ERROR:', JSON.stringify(parsed, null, 2));
    }
  });
});

req.on('error', e => console.error('Request error:', e));
req.write(payload);
req.end();
