import puppeteer from 'puppeteer';

const BASE = 'http://localhost:3000';

const browser = await puppeteer.launch({ headless: true });

async function shot(page, label, url, { width = 1280, actions } = {}) {
  await page.setViewport({ width, height: 900 });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 1500));
  if (actions) await actions(page);
  await page.screenshot({ path: `screenshot-${label}.png`, fullPage: false });
  console.log(`✓ ${label}`);
}

const page = await browser.newPage();

// 1. Dashboard — default tab (All), light
await shot(page, 'step12-dashboard-all-light', `${BASE}/`);

// 2. Dashboard — GK tab
await shot(page, 'step12-dashboard-gk-light', `${BASE}/?leaderboard=gk`);

// 3. Dashboard — DEF tab
await shot(page, 'step12-dashboard-def-light', `${BASE}/?leaderboard=def`);

// 4. Dashboard — MID tab
await shot(page, 'step12-dashboard-mid-light', `${BASE}/?leaderboard=mid`);

// 5. Dashboard — FWD tab
await shot(page, 'step12-dashboard-fwd-light', `${BASE}/?leaderboard=fwd`);

// 6. Dark mode — All tab
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark');
});
await shot(page, 'step12-dashboard-all-dark', `${BASE}/`);

// Pick a player that has a DGW (GW 26 has DGW data). First find one from the leaderboard.
// Use Gyokeres (search in DB)
const { default: Database } = await import('better-sqlite3');
const db = new Database('/Users/teerex/Desktop/Practice/FPLPlayerConfidence/data/fpl.db');
const dgwRow = db
  .prepare(
    `
  SELECT cs.player_id FROM confidence_snapshots cs
  WHERE cs.reason LIKE 'DGW:%'
  LIMIT 1
`,
  )
  .get();
const dgwPlayerId = dgwRow?.player_id;

if (dgwPlayerId) {
  // 7. Player Detail — match history with DGW cards (light)
  await page.evaluate(() => {
    document.documentElement.removeAttribute('data-theme');
  });
  await shot(page, 'step12-player-dgw-light', `${BASE}/players/${dgwPlayerId}`);

  // 8. Player Detail — chart axis labels (scroll down to chart)
  await shot(page, 'step12-player-chart-light', `${BASE}/players/${dgwPlayerId}`, {
    actions: async (p) => {
      await p.evaluate(() => {
        const chart = document.querySelector('section[aria-label="Confidence over time"]');
        if (chart) chart.scrollIntoView({ behavior: 'instant' });
      });
      await new Promise((r) => setTimeout(r, 400));
    },
  });
}

// 9. Trend strip — no-data vs neutral (players list)
await shot(page, 'step12-players-trend-light', `${BASE}/players`);

// 10. Dashboard whitespace fix (dark)
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark');
});
await shot(page, 'step12-dashboard-whitespace-dark', `${BASE}/`);

db.close();
await browser.close();
console.log('All checkpoint (a) screenshots done.');
