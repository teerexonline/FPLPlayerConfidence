/**
 * Captures checkpoint (a) screenshots for §09 ConfidenceTrend variants.
 * Uses a very tall viewport so the full section fits and clip coords work.
 */
import puppeteer from 'puppeteer';
import { resolve } from 'path';

const BASE = 'http://localhost:3000';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function makePage(browser, { width, theme, viewportHeight = 8000 }) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: viewportHeight, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/dev/styles`, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await new Promise((r) => setTimeout(r, 800));
  return page;
}

// Returns viewport-relative bounding box of §09 after scrolling it to the top.
async function getSection09Clip(page, padV = 24, padH = 8) {
  // First scroll to §09 so it sits near viewport top
  await page.evaluate(() => {
    const marker = Array.from(document.querySelectorAll('span')).find(
      (s) => s.textContent?.trim() === '09',
    );
    marker?.closest('section')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  await new Promise((r) => setTimeout(r, 300));

  // getBoundingClientRect() is viewport-relative — exactly what clip needs
  return page.evaluate(
    (padV, padH) => {
      const marker = Array.from(document.querySelectorAll('span')).find(
        (s) => s.textContent?.trim() === '09',
      );
      const section = marker?.closest('section');
      if (!section) return null;
      const r = section.getBoundingClientRect();
      return {
        x: Math.max(0, r.left - padH),
        y: Math.max(0, r.top - padV),
        width: r.width + padH * 2,
        height: r.height + padV * 2,
      };
    },
    padV,
    padH,
  );
}

async function captureSection09(label, width, theme) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await makePage(browser, { width, theme });
  const clip = await getSection09Clip(page);
  if (!clip) {
    console.error('§09 not found');
    await browser.close();
    return;
  }

  const out = resolve(`screenshot-${label}.png`);
  await page.screenshot({ path: out, clip });
  console.log(`Saved: ${out}  (${Math.round(clip.width)}×${Math.round(clip.height)} px)`);
  await browser.close();
}

// Capture each of the 3 TrendShowcase tables individually at 375px
async function captureRows375(theme) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await makePage(browser, { width: 375, theme });

  // First scroll §09 into view so everything renders
  await page.evaluate(() => {
    const marker = Array.from(document.querySelectorAll('span')).find(
      (s) => s.textContent?.trim() === '09',
    );
    marker?.closest('section')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  await new Promise((r) => setTimeout(r, 400));

  // Get each .rounded-lg.border table inside §09
  const boxes = await page.evaluate(() => {
    const marker = Array.from(document.querySelectorAll('span')).find(
      (s) => s.textContent?.trim() === '09',
    );
    const section = marker?.closest('section');
    if (!section) return [];
    return Array.from(section.querySelectorAll('.rounded-lg.border'))
      .slice(0, 3)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, width: r.width, height: r.height };
      });
  });

  const names = ['a-sparkline', 'b-strip', 'c-both'];
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const clip = {
      x: Math.max(0, b.x - 4),
      y: Math.max(0, b.y - 8),
      width: b.width + 8,
      height: b.height + 16,
    };
    const out = resolve(`screenshot-row-375-${names[i]}.png`);
    await page.screenshot({ path: out, clip });
    console.log(`Saved: ${out}  (${Math.round(clip.width)}×${Math.round(clip.height)} px)`);
  }

  await browser.close();
}

await captureSection09('trend-light-desktop', 1440, 'light');
await captureSection09('trend-dark-desktop', 1440, 'dark');
await captureSection09('trend-light-375', 375, 'light');
await captureRows375('light');
console.log('Done.');
