require('dotenv').config({ path: '.env.local' });

const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function test() {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      messages: [
        {
          topic: 'test',
          event: 'test_event',
          payload: { test: 123 }
        }
      ]
    })
  });
  
  console.log(res.status, await res.text());
}
test();
