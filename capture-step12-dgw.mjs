import puppeteer from 'puppeteer';

const BASE = 'http://localhost:3000';
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

// Use Gabriel (id=5) who has a complex DGW with DefCon + Assist (MOTM) + Fatigue
await page.goto(`${BASE}/players/5`, { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 1500));

// Scroll the match history strip to the right so GW26 DGW card is visible
await page.evaluate(() => {
  const list = document.querySelector('[role="list"][aria-label="Match cards"]');
  if (list) list.scrollLeft = 1000; // scroll right to show later GWs
});
await new Promise((r) => setTimeout(r, 300));

// Scroll page to match history section
await page.evaluate(() => {
  const section = document.querySelector('section[aria-label="Match history"]');
  if (section) section.scrollIntoView({ behavior: 'instant', block: 'start' });
});
await new Promise((r) => setTimeout(r, 300));

await page.screenshot({ path: 'screenshot-step12-dgw-card-light.png', fullPage: false });
console.log('✓ step12-dgw-card-light');

await browser.close();
