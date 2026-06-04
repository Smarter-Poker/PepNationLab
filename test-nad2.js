const token = "NAD+";
const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const r1 = new RegExp(`\\b${escapedToken}\\b`, 'i');
console.log(r1.test("This is NAD+ in text"));
console.log(r1.test("This is NAD+"));
const r2 = new RegExp(`(?:^|\\s|\\b)${escapedToken}(?:$|\\s|\\b)`, 'i');
console.log(r2.test("This is NAD+ in text"));
console.log(r2.test("This is NAD+"));
console.log(r2.test("human gonadotropin"));
