const { chromium } = require('playwright');
const assert = require('assert');

async function run() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  
  // User 1
  const context1 = await browser.newContext();
  const page1 = await context1.newPage();
  
  // User 2
  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  
  console.log('Logging in User 1...');
  await page1.goto('https://pepnationlab.com/login');
  await page1.fill('input[type="email"], input[type="text"]', 'test_ws_debug@example.com');
  await page1.fill('input[type="password"]', 'Password123!');
  await page1.click('button:has-text("Sign In"), button:has-text("Login")');
  await page1.waitForURL('**/dashboard**', { timeout: 15000 }).catch(() => {});
  
  console.log('Logging in User 2...');
  await page2.goto('https://pepnationlab.com/login');
  await page2.fill('input[type="email"], input[type="text"]', 'anna');
  await page2.fill('input[type="password"]', '12345678');
  await page2.click('button:has-text("Sign In"), button:has-text("Login")');
  await page2.waitForURL('**/dashboard**', { timeout: 15000 }).catch(() => {});
  
  console.log('Navigating to messenger...');
  await page1.goto('https://pepnationlab.com/messenger');
  await page2.goto('https://pepnationlab.com/messenger');
  
  // Create a new conversation between them or find existing
  console.log('User 1 clicking New Message...');
  await page1.click('button:has-text("New")').catch(() => page1.click('svg[class*="lucide-plus"]'));
  await page1.fill('input[placeholder*="Search"]', 'anna');
  await page1.waitForTimeout(2000);
  await page1.click('text=anna').catch(() => page1.click('div[role="button"]:has-text("anna")'));
  
  console.log('User 1 sending message...');
  const testMsg = `Hello from playwright ${Date.now()}`;
  await page1.fill('textarea, input[placeholder*="message"]', testMsg);
  await page1.waitForTimeout(500);
  
  // Before sending, verify typing bubble appears for User 2!
  console.log('Checking User 2 for typing bubble...');
  // Navigate User 2 to the same conversation
  // Wait, User 2 needs to click the conversation on the sidebar
  await page2.click('text=test_ws_debug').catch(() => {});
  
  // Check if typing bubble appears
  const typingBubble = await page2.locator('text=is typing').count();
  console.log('Typing bubble count on User 2:', typingBubble);
  
  console.log('User 1 submitting message...');
  await page1.keyboard.press('Enter');
  
  console.log('Checking User 2 for received message...');
  await page2.waitForTimeout(2000);
  const msgReceived = await page2.locator(`text=${testMsg}`).count();
  console.log('Message received count on User 2:', msgReceived);
  
  await browser.close();
}
run().catch(console.error);
