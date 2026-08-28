const originalRetail = 100;
const qty = 10;
const flashDiscountPct = 10;
const volumeDiscountPct = 20;

const cartSubtotal = originalRetail * qty; // 1000
const volumeDiscount = (originalRetail - (originalRetail * (1 - volumeDiscountPct/100))) * qty; // 200
const flashDiscount = cartSubtotal * (flashDiscountPct / 100); // 100
const clientTotal = cartSubtotal - volumeDiscount - flashDiscount;

let serverRetail = originalRetail;
serverRetail = serverRetail * (1 - flashDiscountPct/100);
serverRetail = serverRetail * (1 - volumeDiscountPct/100);
const serverTotal = serverRetail * qty;

console.log("Client:", clientTotal, "Server:", serverTotal);
