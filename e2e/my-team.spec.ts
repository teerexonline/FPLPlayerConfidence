import { expect, test } from '@playwright/test';
import type { MyTeamData } from '../src/app/my-team/_components/types';

/**
 * My Team page E2E.
 *
 * The /api/my-team route calls the live FPL API, so we intercept it with
 * page.route() and return deterministic fixture data. This keeps the tests
 * fast and offline-safe while still exercising the full client state machine.
 */

function makePlayer(
  n: number,
  squadPosition: number,
  isCaptain = false,
  isViceCaptain = false,
): MyTeamData['starters'][number] {
  return {
    playerId: n,
    webName: `Player${n.toString()}`,
    teamCode: 14,
    teamShortName: 'LIV',
    position: 'MID' as const,
    squadPosition,
    isCaptain,
    isViceCaptain,
    confidence: n % 5,
    nowCost: 70,
    status: 'a',
    chanceOfPlaying: null,
    news: '',
    hotStreak: null,
    nextFixtures: [],
    projectedXp: null,
    isSwappedIn: false,
  };
}

const MOCK_DATA: MyTeamData = {
  managerName: 'Test Manager',
  teamName: 'Test FC',
  overallRank: 123456,
  overallPoints: 1800,
  gameweek: 32,
  teamConfidencePercent: 62.5,
  defencePercent: 65,
  midfieldPercent: 60,
  attackPercent: 62.5,
  defenceXp: 18,
  midfieldXp: 22,
  attackXp: 17,
  starters: [
    { ...makePlayer(1, 1), isCaptain: true, position: 'GK' as const },
    makePlayer(2, 2),
    makePlayer(3, 3),
    makePlayer(4, 4),
    makePlayer(5, 5),
    makePlayer(6, 6),
    makePlayer(7, 7),
    makePlayer(8, 8),
    makePlayer(9, 9),
    { ...makePlayer(10, 10), isViceCaptain: true },
    makePlayer(11, 11),
  ],
  bench: [makePlayer(12, 12), makePlayer(13, 13), makePlayer(14, 14), makePlayer(15, 15)],
  syncedAt: Date.now(),
  freeHitBypassed: false,
  freeHitGameweek: null,
  isGw1FreeHit: false,
  preDeadlineFallback: false,
  currentGameweek: 34,
  availableGameweeks: [34],
  lastSeasonGameweek: 38,
  viewMode: 'historical',
  projectedTeamXp: null,
  appliedSwaps: [],
  bank: 0,
  squadValue: 1000,
  freeTransfers: 1,
  stagedTransferCount: 0,
  stagedTransferBankDelta: 0,
  stagedTransferPointCost: 0,
};

const MOCK_BODY = JSON.stringify(MOCK_DATA);

/** Intercept /api/my-team and return mock data. */
async function mockMyTeamApi(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/api/my-team**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: MOCK_BODY }),
  );
}

test.describe('My Team page', () => {
  test.beforeEach(async ({ context }) => {
    // Clear localStorage before every test to guarantee the empty state.
    await context.addInitScript(() => {
      localStorage.removeItem('fpl-team-id');
    });
  });

  test('renders the ConnectTeamForm when no team ID is stored', async ({ page }) => {
    await page.goto('/my-team');
    await expect(
      page.getByRole('heading', { level: 1, name: /Connect your FPL team/i }),
    ).toBeVisible();
    await expect(page.getByLabel('FPL Team ID')).toBeVisible();
    await expect(page.getByRole('button', { name: /Load my team/i })).toBeVisible();
  });

  test('shows a validation error for empty submission', async ({ page }) => {
    await page.goto('/my-team');
    await page.getByRole('button', { name: /Load my team/i }).click();
    // Filter to the specific form alert, not the Next.js route announcer.
    await expect(
      page.getByRole('alert').filter({ hasText: /valid numeric team ID/i }),
    ).toBeVisible();
  });

  test('shows a validation error for non-numeric team ID', async ({ page }) => {
    await page.goto('/my-team');
    await page.getByLabel('FPL Team ID').fill('abc');
    await page.getByRole('button', { name: /Load my team/i }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: /valid numeric team ID/i }),
    ).toBeVisible();
  });

  test('loads the team and renders the loaded view with 11 starters and 4 bench', async ({
    page,
  }) => {
    await mockMyTeamApi(page);
    await page.goto('/my-team');
    await page.getByLabel('FPL Team ID').fill('231177');
    await page.getByRole('button', { name: /Load my team/i }).click();

    // Manager header should appear.
    await expect(page.getByRole('heading', { name: 'Test Manager' })).toBeVisible();

    // Starting XI list: 11 list items under the "Starting XI" region.
    const startingXI = page.getByRole('region', { name: 'Starting XI' });
    await expect(startingXI).toBeVisible();
    await expect(startingXI.getByRole('listitem')).toHaveCount(11);

    // Bench section: 4 list items under the "Bench" region.
    const bench = page.getByRole('region', { name: 'Bench' });
    await expect(bench).toBeVisible();
    await expect(bench.getByRole('listitem')).toHaveCount(4);
  });

  test('captain badge is visible in the Starting XI', async ({ page }) => {
    await mockMyTeamApi(page);
    await page.goto('/my-team');
    await page.getByLabel('FPL Team ID').fill('231177');
    await page.getByRole('button', { name: /Load my team/i }).click();

    // Wait for the loaded view before looking for badges.
    await expect(page.getByRole('heading', { name: 'Test Manager' })).toBeVisible();

    await expect(page.locator('[aria-label="Captain"]')).toBeVisible();
    await expect(page.locator('[aria-label="Vice captain"]')).toBeVisible();
  });

  test('persists the team ID in localStorage after a successful load', async ({ page }) => {
    await mockMyTeamApi(page);
    await page.goto('/my-team');
    await page.getByLabel('FPL Team ID').fill('231177');
    await page.getByRole('button', { name: /Load my team/i }).click();
    await expect(page.getByRole('heading', { name: 'Test Manager' })).toBeVisible();

    const stored = await page.evaluate(() => localStorage.getItem('fpl-team-id'));
    expect(stored).toBe('231177');
  });

  test('shows NOT_FOUND alert on 404 response', async ({ page }) => {
    await page.route('**/api/my-team**', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'NOT_FOUND' }),
      }),
    );

    await page.goto('/my-team');
    await page.getByLabel('FPL Team ID').fill('999999999');
    await page.getByRole('button', { name: /Load my team/i }).click();

    await expect(page.getByRole('alert').filter({ hasText: /Team not found/i })).toBeVisible();
  });

  test('"Change team ID" button resets to the empty state and clears localStorage', async ({
    page,
  }) => {
    await mockMyTeamApi(page);
    await page.goto('/my-team');
    await page.getByLabel('FPL Team ID').fill('231177');
    await page.getByRole('button', { name: /Load my team/i }).click();
    await expect(page.getByRole('heading', { name: 'Test Manager' })).toBeVisible();

    // Click "Change team ID" in the footer.
    await page.getByRole('button', { name: /Change team ID/i }).click();

    // Should return to the ConnectTeamForm.
    await expect(
      page.getByRole('heading', { level: 1, name: /Connect your FPL team/i }),
    ).toBeVisible();

    // localStorage cleared.
    const stored = await page.evaluate(() => localStorage.getItem('fpl-team-id'));
    expect(stored).toBeNull();
  });

  test('loads team data directly when a team ID is already stored in localStorage', async ({
    page,
  }) => {
    // Pre-seed localStorage before the first navigation by injecting a page-level
    // init script (runs before context-level beforeEach scripts? No — addInitScript
    // ordering: context scripts run first). We use page.addInitScript here so it
    // also runs on the upcoming goto, and use localStorage.setItem directly so the
    // context-level removeItem in beforeEach doesn't interfere (they run in the
    // same script execution order).
    //
    // The cleanest approach: seed via evaluate AFTER goto, then reload, verifying
    // the state machine re-fetches from storage on mount after a hard navigation.
    // But since context.addInitScript clears storage on every navigation, we test
    // this via a direct page.addInitScript override that sets the key AFTER the
    // context script clears it.
    await mockMyTeamApi(page);

    // Register a page-level init script that runs after the context-level one.
    // Context scripts run first; page scripts run after — so this wins.
    await page.addInitScript(() => {
      localStorage.setItem('fpl-team-id', '231177');
    });

    await page.goto('/my-team');

    // The hydration effect should pick up the stored team ID and fetch.
    await expect(page.getByRole('heading', { name: 'Test Manager' })).toBeVisible();
  });
});
