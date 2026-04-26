import { expect, test } from '@playwright/test';

/**
 * Dashboard page E2E.
 *
 * Seed state (from e2e/setup/seed-db.ts):
 *   - 200 generic players with snapshots at GW1–GW5 (stale: currentGW=14 minus GW5 = 9 > 3)
 *   - Gabriel (id=5, ARS DEF) with snapshots at GW1–GW14, final confidence +5, delta +2
 *   - M. Salah (id=9999, LIV MID) with snapshots at GW1–GW5 (stale)
 *   - sync_meta.current_gameweek = 14
 *
 * With the stale filter (>3 GWs behind currentGW), only Gabriel passes through.
 * This makes all dashboard expectations fully deterministic.
 */

test.describe('Dashboard page', () => {
  test('renders the page with correct title and GW pill', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    // Topbar GW pill reflects sync_meta.current_gameweek = 14
    await expect(page.getByLabel('Gameweek 14')).toBeVisible();
  });

  test('topbar wordmark links to home', async ({ page }) => {
    await page.goto('/');
    const wordmark = page.getByRole('link', { name: /FPL Confidence.*home/i });
    await expect(wordmark).toBeVisible();
    await expect(wordmark).toHaveAttribute('href', '/');
  });

  test('biggest risers card is rendered', async ({ page }) => {
    await page.goto('/');
    const risers = page.getByRole('region', { name: /biggest confidence risers/i });
    await expect(risers).toBeVisible();
    // Gabriel has delta +2 at GW14 — he is the only active riser
    await expect(risers.getByText('Gabriel')).toBeVisible();
  });

  test('biggest fallers card shows empty state when no active fallers', async ({ page }) => {
    await page.goto('/');
    // All players with negative deltas are stale; no active player has a negative delta
    const fallers = page.getByRole('region', { name: /biggest confidence fallers/i });
    await expect(fallers).toBeVisible();
    await expect(fallers.getByText(/No players lost confidence/i)).toBeVisible();
  });

  test('watchlist card renders empty state', async ({ page }) => {
    await page.goto('/');
    const watchlist = page.getByRole('region', { name: /watchlist/i });
    await expect(watchlist).toBeVisible();
    await expect(watchlist.getByText(/No watchlist yet/i)).toBeVisible();
    const browseCta = watchlist.getByRole('link', { name: /browse players/i });
    await expect(browseCta).toBeVisible();
    await expect(browseCta).toHaveAttribute('href', '/players');
  });

  test('confidence leaderboard is rendered with Gabriel at rank 1', async ({ page }) => {
    await page.goto('/');
    const leaderboard = page.getByRole('region', { name: /confidence leaderboard/i });
    await expect(leaderboard).toBeVisible();

    // Gabriel is the only non-stale player → rank 1.
    // The table has an sr-only header rowgroup; target the data rowgroup (last one) for the first data row.
    const table = leaderboard.getByRole('table');
    const dataRowgroup = table.locator('[role="rowgroup"]').last();
    await expect(dataRowgroup.getByRole('row').first()).toContainText('Gabriel');
  });

  test('leaderboard row navigates to player detail on click', async ({ page }) => {
    await page.goto('/');
    const leaderboard = page.getByRole('region', { name: /confidence leaderboard/i });
    // Gabriel is the only data row — click his name directly (bubbles to row onClick).
    await leaderboard.getByText('Gabriel').click();
    await expect(page).toHaveURL(/\/players\/5/);
    await expect(page.getByRole('heading', { name: 'Gabriel' })).toBeVisible();
  });

  test('leaderboard "View all" link navigates to /players', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /view all/i }).click();
    await expect(page).toHaveURL('/players');
  });

  test('stale players are absent from the leaderboard', async ({ page }) => {
    await page.goto('/');
    const leaderboard = page.getByRole('region', { name: /confidence leaderboard/i });
    // M. Salah (GW5, stale at currentGW=14) must not appear in the dashboard leaderboard
    await expect(leaderboard.getByText('M. Salah')).not.toBeVisible();
  });

  test('browse players link navigates to /players', async ({ page }) => {
    await page.goto('/');
    // The watchlist CTA and "View all" share intent; test the watchlist CTA
    await page.getByRole('link', { name: /browse players/i }).click();
    await expect(page).toHaveURL('/players');
  });
});
