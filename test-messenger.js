const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  page.on('websocket', ws => {
    console.log('WEBSOCKET CONNECTED:', ws.url());
    ws.on('framereceived', frame => console.log('WS RECEIVE:', frame.payload));
    ws.on('framesent', frame => console.log('WS SEND:', frame.payload));
  });

  console.log('Navigating to login...');
  await page.goto('https://pepnationlab.com/login');
  
  await page.fill('input[type="text"]', 'savagebrands');
  await page.fill('input[type="password"]', 'WrongPassword123'); // I will try to use the test storefront account to see if it can log into messenger, or at least see what WS errors happen on the login page (or maybe there are errors before login?)
  
  // Wait, I don't have a valid messenger account login for smarter.poker.
  // The user says "I'VE TRIED SEPERATE BROWSERS".
  
  await browser.close();
})();
