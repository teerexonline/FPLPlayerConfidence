import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.goto('http://localhost:3000/players/430', { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise((r) => setTimeout(r, 1200));

// Scroll history strip to the far end so GW33 card is visible
await page.evaluate(() => {
  const strip = document.querySelector('[role="list"]');
  if (strip) strip.scrollLeft = strip.scrollWidth;
});
await new Promise((r) => setTimeout(r, 500));

// Capture the match history section
const historySection = await page.$('[role="list"]');
let clip;
if (historySection) {
  const box = await historySection.boundingBox();
  if (box)
    clip = { x: box.x, y: Math.max(0, box.y - 48), width: box.width, height: box.height + 64 };
}
const bytes1 = await page.screenshot({ clip, encoding: 'base64' });
writeFileSync('screenshot-haaland-dgw-card.png', Buffer.from(bytes1, 'base64'));

// Also grab a wider viewport showing chart annotation area
await page.evaluate(() => {
  const strip = document.querySelector('[role="list"]');
  if (strip) strip.scrollLeft = 0;
});
await new Promise((r) => setTimeout(r, 300));
const allText = await page.evaluate(() => document.body.innerText);
const dgwLines = allText.split('\n').filter((l) => l.includes('DGW'));
console.log('DGW text on page:', JSON.stringify(dgwLines));

await browser.close();
