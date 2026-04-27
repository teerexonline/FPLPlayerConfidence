/**
 * Captures 6 screenshots of the My Team page with GW scrubber.
 * Mocks /api/my-team so no live FPL API calls are needed.
 * light + dark × (latest GW34, mid GW33, oldest GW32).
 */
import puppeteer from 'puppeteer';
import { resolve } from 'path';

const TEAM_ID = 231177;
const URL = 'http://localhost:3000/my-team';
const MODES = ['light', 'dark'];
const AVAILABLE_GWS = [32, 33, 34];
const CURRENT_GW = 34;

function makePlayer(
  squadPosition,
  playerId,
  webName,
  position,
  teamCode,
  teamShortName,
  confidence,
) {
  return {
    playerId,
    webName,
    teamCode,
    teamShortName,
    position,
    squadPosition,
    isCaptain: squadPosition === 10,
    isViceCaptain: squadPosition === 9,
    confidence,
    status: 'a',
    chanceOfPlaying: null,
    news: '',
  };
}

function makeResponse(gameweek) {
  const confidenceMap = { 32: 52, 33: 61, 34: 68 };
  const starters = [
    makePlayer(1, 736, 'Donnarumma', 'GK', 13, 'PSG', 2),
    makePlayer(2, 317, 'Andersen', 'DEF', 10, 'CRY', 1),
    makePlayer(3, 5, 'Gabriel', 'DEF', 1, 'ARS', 3),
    makePlayer(4, 402, 'Wan-Bissaka', 'DEF', 12, 'WHU', 0),
    makePlayer(5, 233, 'Mykolenko', 'DEF', 11, 'EVE', -1),
    makePlayer(6, 260, 'Salah', 'MID', 14, 'LIV', 4),
    makePlayer(7, 287, 'Saka', 'MID', 1, 'ARS', 3),
    makePlayer(8, 303, 'Mbeumo', 'MID', 5, 'BRE', 2),
    makePlayer(9, 310, 'Andreas', 'MID', 8, 'FUL', 1),
    makePlayer(10, 314, 'Haaland', 'FWD', 43, 'MCI', 5),
    makePlayer(11, 47, 'Watkins', 'FWD', 7, 'AVL', -1),
  ];
  const bench = [
    makePlayer(12, 100, 'Flekken', 'GK', 5, 'BRE', 0),
    makePlayer(13, 200, 'Pedro Porro', 'DEF', 6, 'TOT', 1),
    makePlayer(14, 300, 'Mitoma', 'MID', 36, 'BHA', 2),
    makePlayer(15, 400, 'Isak', 'FWD', 4, 'NEW', 3),
  ];
  const pct = confidenceMap[gameweek] ?? 60;
  return {
    managerName: 'Test Manager',
    teamName: 'Autonomy FC',
    overallRank: 42345,
    overallPoints: 2187,
    gameweek,
    teamConfidencePercent: pct,
    defencePercent: pct - 5,
    midfieldPercent: pct + 3,
    attackPercent: pct,
    starters,
    bench,
    syncedAt: Date.now(),
    freeHitBypassed: false,
    freeHitGameweek: null,
    isGw1FreeHit: false,
    preDeadlineFallback: false,
    currentGameweek: CURRENT_GW,
    availableGameweeks: AVAILABLE_GWS,
  };
}

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

for (const mode of MODES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: mode },
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ]);

  // Intercept API calls and return mock data based on the gameweek param.
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.url().includes('/api/my-team')) {
      const rawUrl = req.url();
      const gwMatch = rawUrl.match(/[?&]gameweek=(\d+)/);
      const gw = gwMatch ? parseInt(gwMatch[1], 10) : CURRENT_GW;
      void req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeResponse(gw)),
      });
    } else {
      void req.continue();
    }
  });

  // Pre-set the team ID in localStorage.
  await page.evaluateOnNewDocument((teamId) => {
    localStorage.setItem('fpl-team-id', String(teamId));
  }, TEAM_ID);

  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200));

  const SHOTS = [
    { label: 'latest', gwToClick: null },
    { label: 'mid', gwToClick: 33 },
    { label: 'oldest', gwToClick: 32 },
  ];

  for (const { label, gwToClick } of SHOTS) {
    if (gwToClick !== null) {
      const pills = await page.$$('nav[aria-label="Gameweek timeline"] li');
      let clicked = false;
      for (const pill of pills) {
        const ariaLabel = await page.evaluate((el) => el.getAttribute('aria-label'), pill);
        if (ariaLabel === `GW${gwToClick}`) {
          await pill.click();
          await new Promise((r) => setTimeout(r, 2000));
          clicked = true;
          break;
        }
      }
      if (!clicked) console.warn(`Could not find GW${gwToClick} pill`);
    }

    const outPath = resolve(`screenshot-23-scrubber-${label}-${mode}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`Saved: screenshot-23-scrubber-${label}-${mode}.png`);
  }

  await page.close();
}

await browser.close();
console.log('Done.');
