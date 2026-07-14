const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

async function test() {
  const fileContent = "dummy image content";
  fs.writeFileSync('test.png', fileContent);
  
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', fs.createReadStream('test.png'), {
    filename: 'test.png',
    contentType: 'image/png',
  });

  try {
    const res = await fetch('http://localhost:3000/api/agent/bundles/upload-image', {
      method: 'POST',
      body: form,
      headers: {
        'cookie': 'sb-access-token=dummy', // Will fail auth but we can see the error
        ...form.getHeaders()
      }
    });
    console.log(res.status);
    console.log(await res.text());
  } catch(e) {
    console.error(e);
  }
}
test();
