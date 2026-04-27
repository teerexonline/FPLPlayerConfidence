import puppeteer from 'puppeteer';
import { resolve } from 'path';

const BASE = 'http://localhost:3001';
const TEAM_ID = '231177';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function capture({ label, dark, width = 1440, height = 900 }) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate((id) => {
    localStorage.setItem('fpl-team-id', id);
  }, TEAM_ID);
  await page.goto(`${BASE}/my-team`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1800));
  if (dark) await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await new Promise((r) => setTimeout(r, 400));
  const out = resolve(`screenshot-item2-myteam-${label}.png`);
  await page.screenshot({ path: out, fullPage: true });
  console.log(`✓ ${label} → ${out}`);
  await browser.close();
}

await capture({ label: 'light', dark: false });
await capture({ label: 'dark', dark: true });
console.log('Done.');
