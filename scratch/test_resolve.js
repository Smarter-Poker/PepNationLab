async function test() {
  const res = await fetch('https://pepnationlab.com/api/auth/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'savagebrands' })
  });
  console.log(res.status);
  console.log(await res.text());
}
test();
