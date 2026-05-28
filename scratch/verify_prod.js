async function verify() {
  console.log("1. Testing /api/auth/resolve for savagebrands...");
  const res1 = await fetch('https://pepnationlab.com/api/auth/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'savagebrands' })
  });
  console.log("Status:", res1.status);
  if(res1.status === 200) {
    const data = await res1.json();
    console.log("Data:", data);
  } else {
    console.log("Response text:", await res1.text());
  }
}
verify();
