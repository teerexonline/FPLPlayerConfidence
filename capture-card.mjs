import puppeteer from 'puppeteer';
import { resolve } from 'path';

const BASE = 'http://localhost:3000';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function captureSection(label, sectionNum, width, theme) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  // Viewport must be taller than the full page so nothing needs scrolling.
  // Page at 375px is ~9200px tall. Use 14000px to be safe.
  await page.setViewport({ width, height: 14000, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/dev/styles`, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await new Promise((r) => setTimeout(r, 1000));

  // All content is in view (no scroll). getBoundingClientRect().top == absolute doc Y.
  const clip = await page.evaluate((num) => {
    const marker = Array.from(document.querySelectorAll('span')).find(
      (s) => s.textContent?.trim() === num,
    );
    const section = marker?.closest('section');
    if (!section) return null;
    const r = section.getBoundingClientRect();
    return {
      x: Math.max(0, r.left - 8),
      y: Math.max(0, r.top - 16),
      width: r.width + 16,
      height: r.height + 32,
    };
  }, sectionNum);

  if (!clip) {
    console.error(`Section ${sectionNum} not found`);
    await browser.close();
    return;
  }

  const out = resolve(`screenshot-${label}.png`);
  await page.screenshot({ path: out, clip });
  console.log(
    `Saved: ${out}  (${Math.round(clip.width * 2)}×${Math.round(clip.height * 2)} physical px)`,
  );
  await browser.close();
}

await captureSection('card-light-375', '12', 500, 'light');
await captureSection('card-dark-375', '12', 500, 'dark');
console.log('Done.');
