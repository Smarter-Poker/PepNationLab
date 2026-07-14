const http = require('http');
async function test() {
  const fetch = (await import('node-fetch')).default;
  try {
    const res = await fetch('http://localhost:3000/api/agent/products', {
      headers: {
        'cookie': 'sb-access-token=dummy'
      }
    });
    const json = await res.json();
    console.log(json);
  } catch(e) {
    console.error(e);
  }
}
test();
