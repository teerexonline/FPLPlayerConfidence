/**
 * Dev-only screenshot script for the /dev/styles page.
 * Run with: node scripts/screenshot-styles.mjs
 * Requires: npx playwright install chromium
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

mkdirSync('./screenshots', { recursive: true });

const browser = await chromium.launch();

async function shot(label, setup) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3001/dev/styles', { waitUntil: 'networkidle' });
  if (setup) await setup(page);
  await page.waitForTimeout(400); // let theme transition settle
  await page.screenshot({ path: `./screenshots/styles-${label}.png`, fullPage: true });
  await page.close();
  console.log(`✓ screenshots/styles-${label}.png`);
}

// Light mode (system default — next-themes resolves to light in headless)
await shot('light', null);

// Dark mode — set data-theme directly on <html>
await shot('dark', async (page) => {
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });
});

await browser.close();
console.log('Done.');
