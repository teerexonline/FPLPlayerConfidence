import { expect, test } from '@playwright/test';

test.describe('Players list page', () => {
  test('cold start — /players renders > 100 rows', async ({ page }) => {
    await page.goto('/players');

    // Wait for the page header to confirm the RSC loaded.
    await expect(page.getByRole('heading', { name: 'Players' })).toBeVisible();

    // The player count is shown in the subheading (e.g. "201 players · FPL 2024/25").
    // We verify > 100 players rendered by checking the subtitle text.
    const subtitle = page.locator('header p');
    await expect(subtitle).toBeVisible();
    const text = await subtitle.textContent();
    const match = /^(\d+) players/.exec(text ?? '');
    if (!match) throw new Error('subtitle did not match player count pattern');
    expect(parseInt(match[1] ?? '0', 10)).toBeGreaterThan(100);
  });

  test('search filters list to matching players', async ({ page }) => {
    await page.goto('/players');
    await expect(page.getByRole('heading', { name: 'Players' })).toBeVisible();

    // Focus search and type "salah"
    const search = page.getByRole('searchbox', { name: /search players/i });
    await search.click();
    await search.fill('salah');

    // Only Salah rows should remain; count is shown in the subtitle.
    // Mobile cards: look for the player name in the card layout.
    await expect(page.getByText('M. Salah').first()).toBeVisible();

    // Players that don't match should not be visible.
    await expect(page.getByText('A. Anderson').first()).not.toBeVisible();
  });

  test('clicking a player row navigates to /players/[id]', async ({ page }) => {
    await page.goto('/players');
    await expect(page.getByRole('heading', { name: 'Players' })).toBeVisible();

    // Search for Salah to get a small filtered list.
    const search = page.getByRole('searchbox', { name: /search players/i });
    await search.fill('salah');
    await expect(page.getByText('M. Salah').first()).toBeVisible();

    // Click the player name directly — it bubbles to the row's onClick handler.
    // (getByRole('row').first() would pick the column-header row, not a data row.)
    await page.getByText('M. Salah').first().click();

    // The URL should change to /players/[id] — a 404 is expected at this step.
    await expect(page).toHaveURL(/\/players\/\d+/);
  });
});
