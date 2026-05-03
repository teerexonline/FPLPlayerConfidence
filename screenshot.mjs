/**
 * Puppeteer screenshot helper.
 * Usage: node screenshot.mjs <label> <url> [--width=N] [--dark] [--clip-selector=CSS]
 * Output: screenshot-<label>.png in the project root.
 */
import puppeteer from 'puppeteer';
import { resolve } from 'path';

const args = process.argv.slice(2);
const label = args[0];
const url = args[1];
const width = parseInt(args.find((a) => a.startsWith('--width='))?.split('=')[1] ?? '1440', 10);
const dark = args.includes('--dark');
const selectorArg = args
  .find((a) => a.startsWith('--selector='))
  ?.split('=')
  .slice(1)
  .join('=');
const scrollTo = args.find((a) => a.startsWith('--scroll='))?.split('=')[1];
const viewportOnly = args.includes('--viewport-only');
const viewportHeight = parseInt(
  args.find((a) => a.startsWith('--height='))?.split('=')[1] ?? '900',
  10,
);

if (!label || !url) {
  console.error(
    'Usage: node screenshot.mjs <label> <url> [--width=N] [--dark] [--selector=CSS] [--scroll=N]',
  );
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width, height: viewportHeight, deviceScaleFactor: 2 });

await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }]);

await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

// Small settle delay for animations/fonts
await new Promise((r) => setTimeout(r, 800));

if (scrollTo) {
  await page.evaluate((px) => window.scrollTo(0, parseInt(px, 10)), scrollTo);
  await new Promise((r) => setTimeout(r, 300));
}

let clip;
if (selectorArg) {
  const el = await page.$(selectorArg);
  if (el) {
    const box = await el.boundingBox();
    if (box) {
      clip = { x: box.x, y: Math.max(0, box.y - 16), width: box.width, height: box.height + 32 };
    }
  }
}

const outPath = resolve(`screenshot-${label}.png`);
await page.screenshot({ path: outPath, clip, fullPage: !clip && !viewportOnly });
console.log(`Saved: ${outPath}`);
await browser.close();
