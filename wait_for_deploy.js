const https = require('https');
const url = 'https://pepnationlab.com/api/clear-cache-temp';

function checkUrl() {
  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(res.statusCode, data);
      if (res.statusCode === 200 && data.includes('success')) {
        console.log('Cache cleared successfully!');
        process.exit(0);
      } else {
        setTimeout(checkUrl, 5000);
      }
    });
  }).on('error', (err) => {
    console.error('Error:', err.message);
    setTimeout(checkUrl, 5000);
  });
}

console.log('Waiting for Vercel deployment to finish and cache to clear...');
checkUrl();
