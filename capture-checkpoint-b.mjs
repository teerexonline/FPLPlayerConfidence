/**
 * Checkpoint (b) screenshots — My Team loaded state + dashboard with team.
 * Pre-seeds localStorage with team ID 231177 before navigating so the page
 * hydrates straight into the loaded state.
 */
import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const BASE = 'http://localhost:3000';
const TEAM_ID = '231177';

async function capture({
  label,
  url,
  dark = false,
  width = 1440,
  height = 900,
  teamId = null,
  fullPage = true,
}) {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' },
  ]);

  if (teamId) {
    // Two-step: navigate to origin to establish a localStorage context, seed the
    // team ID, then navigate to the target URL so the React hydration effect
    // picks it up immediately on mount.
    await page.goto(`http://localhost:3000/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.evaluate((id) => {
      localStorage.setItem('fpl-team-id', id);
    }, teamId);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  } else {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  }

  // Extra settle for Motion count-up animation.
  await new Promise((r) => setTimeout(r, 1200));

  const outPath = resolve(`screenshot-${label}.png`);
  await page.screenshot({ path: outPath, fullPage });
  console.log(`✓ ${label} → ${outPath}`);

  await browser.close();
}

console.log('Taking checkpoint (b) screenshots…\n');

// ── My Team loaded state ──────────────────────────────────────────────────────
await capture({
  label: 'b-myteam-light-desktop',
  url: `${BASE}/my-team`,
  dark: false,
  width: 1440,
  height: 900,
  teamId: TEAM_ID,
});
await capture({
  label: 'b-myteam-dark-desktop',
  url: `${BASE}/my-team`,
  dark: true,
  width: 1440,
  height: 900,
  teamId: TEAM_ID,
});
await capture({
  label: 'b-myteam-light-mobile',
  url: `${BASE}/my-team`,
  dark: false,
  width: 390,
  height: 844,
  teamId: TEAM_ID,
});
await capture({
  label: 'b-myteam-dark-mobile',
  url: `${BASE}/my-team`,
  dark: true,
  width: 390,
  height: 844,
  teamId: TEAM_ID,
});

// ── Dashboard with team connected ─────────────────────────────────────────────
await capture({
  label: 'b-dashboard-team-light',
  url: `${BASE}/`,
  dark: false,
  width: 1440,
  height: 900,
  teamId: TEAM_ID,
  fullPage: false,
});
await capture({
  label: 'b-dashboard-team-dark',
  url: `${BASE}/`,
  dark: true,
  width: 1440,
  height: 900,
  teamId: TEAM_ID,
  fullPage: false,
});

console.log('\nAll checkpoint (b) screenshots saved.');
