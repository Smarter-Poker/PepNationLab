const res = await fetch("http://localhost:3000/api/merchant-feed/pepnationlab");
console.log(res.status);
console.log(await res.text());
