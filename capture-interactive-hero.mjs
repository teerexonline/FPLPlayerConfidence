/**
 * Captures 6 screenshots of the interactive hero on player detail page:
 * light + dark × (latest GW, middle GW, oldest GW selected).
 * Player 47 has GWs 1–34.
 */
import puppeteer from 'puppeteer';
import { resolve } from 'path';

const URL = 'http://localhost:3000/players/47';
const GWS = { latest: 34, middle: 18, oldest: 1 };
const MODES = ['light', 'dark'];

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

for (const mode of MODES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: mode }]);
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200)); // wait for count-up to settle

  for (const [gwLabel, gw] of Object.entries(GWS)) {
    if (gwLabel !== 'latest') {
      // Click the card
      const card = await page.$(`[data-gameweek="${gw}"]`);
      if (card) {
        await card.click();
        await new Promise((r) => setTimeout(r, 400));
      } else {
        console.warn(`Card for GW${gw} not found`);
      }
    }

    const label = `24-hero-${gwLabel}-${mode}`;
    const outPath = resolve(`screenshot-${label}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`Saved: screenshot-${label}.png`);
  }

  await page.close();
}

await browser.close();
console.log('Done.');
