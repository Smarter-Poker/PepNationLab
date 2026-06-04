const src = "Human Chorionic Gonadotropin";
const token = "nad+";
const rawTokenAlpha = token.replace(/[^a-z0-9]/g, '');
console.log("Stripped token:", rawTokenAlpha);
const strippedSrc = src.toLowerCase().replace(/[^a-z0-9]/g, '');
console.log("Stripped src:", strippedSrc);
console.log("Includes?", strippedSrc.includes(rawTokenAlpha));

const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const regex = new RegExp(`\\b${escapedToken}`, 'i');
console.log("Regex match?", regex.test(src));
