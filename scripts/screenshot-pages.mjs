/**
 * Screenshots dashboard + players page to verify xP rendering.
 */
import puppeteer from 'puppeteer';

const BASE = process.argv[2] ?? 'http://localhost:3000';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

async function snap(label, path, opts = {}) {
  const page = await browser.newPage();
  await page.setViewport({
    width: opts.mobile ? 430 : 1280,
    height: 1400,
    deviceScaleFactor: 2,
    isMobile: !!opts.mobile,
  });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0', timeout: 60_000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: `screenshot-xp-${label}.png`, fullPage: !!opts.fullPage });
  console.log(`✓ screenshot-xp-${label}.png`);
  await page.close();
}

await snap('dashboard-desktop', '/');
await snap('dashboard-mobile', '/', { mobile: true });
await snap('players-desktop', '/players');
await snap('players-mobile', '/players', { mobile: true });

await browser.close();
