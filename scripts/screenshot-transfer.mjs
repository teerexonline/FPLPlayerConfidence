/**
 * Screenshots the My Team page in both historical and projected modes,
 * with the transfer modal open. Seeds localStorage so the FPL team is
 * pre-connected and we land on the loaded view.
 */
import puppeteer from 'puppeteer';

const TEAM_ID = process.argv[2] ?? '1043017';
const BASE = process.argv[3] ?? 'http://localhost:3000';
const DARK = !process.argv.includes('--light');

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

async function snap(label, prepare) {
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 1400, deviceScaleFactor: 2, isMobile: true });
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: DARK ? 'dark' : 'light' },
  ]);
  // Seed localStorage with the FPL team ID before the app reads it.
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((id) => {
    localStorage.setItem('fpl-team-id', id);
  }, TEAM_ID);
  await page.goto(`${BASE}/my-team`, { waitUntil: 'networkidle0', timeout: 60_000 });
  // Wait for the squad to render (manager header presence)
  await page.waitForSelector('main', { timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 1500));

  if (prepare) await prepare(page);

  const path = `screenshot-transfer-${label}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`✓ ${path}`);
  await page.close();
}

// 1. Historical (default GW 35)
await snap('1-historical');

// 2. Projected GW 36 — click forward arrow once
await snap('2-projected-gw36', async (page) => {
  const next = await page.$('button[aria-label="Next gameweek"]');
  if (next) {
    await next.click();
    await new Promise((r) => setTimeout(r, 2000));
  } else {
    console.warn('  no Next button found');
  }
});

// 3. Projected GW 37 — click forward twice
await snap('3-projected-gw37', async (page) => {
  for (let i = 0; i < 2; i++) {
    const next = await page.$('button[aria-label="Next gameweek"]');
    if (next) await next.click();
    await new Promise((r) => setTimeout(r, 1500));
  }
});

// 4. Transfer modal open — projected GW 36, click first swap button
await snap('4-modal-open', async (page) => {
  // Forward to GW 36
  const next = await page.$('button[aria-label="Next gameweek"]');
  if (next) {
    await next.click();
    await new Promise((r) => setTimeout(r, 2000));
  }
  // Click the first "Plan a transfer" button
  const swapBtn = await page.$('button[aria-label^="Plan a transfer"]');
  if (swapBtn) {
    await swapBtn.click();
    await new Promise((r) => setTimeout(r, 1200));
  } else {
    console.warn('  no swap button found');
  }
});

await browser.close();
console.log('\nAll screenshots saved.');
