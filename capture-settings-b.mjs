/**
 * Settings checkpoint (b) screenshots.
 * 8 variants: disconnected+connected × light+dark × desktop+mobile
 */
import puppeteer from 'puppeteer';
import { resolve } from 'path';

const BASE = 'http://localhost:3001';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TEAM_ID = '231177';

async function capture({ label, dark, width, height, teamId }) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });

  if (teamId) {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.evaluate((id) => {
      localStorage.setItem('fpl-team-id', id);
    }, teamId);
  }

  await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));

  if (dark) {
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
  }

  await new Promise((r) => setTimeout(r, 600));

  const outPath = resolve(`screenshot-settings-${label}.png`);
  await page.screenshot({ path: outPath, fullPage: true });
  console.log(`✓ settings-${label} → ${outPath}`);

  await browser.close();
}

console.log('Taking settings checkpoint (b) screenshots…\n');

await capture({
  label: 'disconnected-light-desktop',
  dark: false,
  width: 1440,
  height: 900,
  teamId: null,
});
await capture({
  label: 'disconnected-dark-desktop',
  dark: true,
  width: 1440,
  height: 900,
  teamId: null,
});
await capture({
  label: 'disconnected-light-mobile',
  dark: false,
  width: 390,
  height: 844,
  teamId: null,
});
await capture({
  label: 'disconnected-dark-mobile',
  dark: true,
  width: 390,
  height: 844,
  teamId: null,
});
await capture({
  label: 'connected-light-desktop',
  dark: false,
  width: 1440,
  height: 900,
  teamId: TEAM_ID,
});
await capture({
  label: 'connected-dark-desktop',
  dark: true,
  width: 1440,
  height: 900,
  teamId: TEAM_ID,
});
await capture({
  label: 'connected-light-mobile',
  dark: false,
  width: 390,
  height: 844,
  teamId: TEAM_ID,
});
await capture({
  label: 'connected-dark-mobile',
  dark: true,
  width: 390,
  height: 844,
  teamId: TEAM_ID,
});

console.log('\nAll 8 screenshots saved.');
