import { expect, test } from '@playwright/test';

/**
 * Player detail page E2E.
 * Uses Gabriel (id=5, ARS DEF, confidence +5) seeded by the global DB setup.
 * Tests: navigation from list, hero rendering, strip, chart, breakdown, not-found.
 */

test.describe('Player detail page', () => {
  test('navigates from the players list to a player detail page', async ({ page }) => {
    await page.goto('/players');
    await expect(page.getByRole('heading', { name: 'Players' })).toBeVisible();

    // Search for Gabriel so he scrolls into the virtual list viewport.
    const search = page.getByRole('searchbox', { name: /search players/i });
    await search.fill('Gabriel');
    await expect(page.getByText('Gabriel').first()).toBeVisible();

    // Click Gabriel's name — bubbles to the row onClick which navigates to /players/5.
    await page.getByText('Gabriel').first().click();
    await expect(page).toHaveURL(/\/players\/5/);
    await expect(page.getByRole('link', { name: /players/i })).toBeVisible();
  });

  test('Gabriel detail page renders PlayerHeader with name and meta', async ({ page }) => {
    await page.goto('/players/5');

    // Fraunces name
    await expect(page.getByRole('heading', { name: 'Gabriel' })).toBeVisible();

    // Team + position + price in the header
    await expect(page.getByText('Arsenal')).toBeVisible();
  });

  test('hero section shows confidence number and slider', async ({ page }) => {
    await page.goto('/players/5');

    // aria-live polite region wraps the ConfidenceNumber
    const heroSection = page.getByRole('region', { name: /player confidence/i });
    await expect(heroSection).toBeVisible();

    // ConfidenceSlider renders as role=meter
    const meter = page.getByRole('meter');
    await expect(meter).toBeVisible();
    await expect(meter).toHaveAttribute('aria-valuemin', '-5');
    await expect(meter).toHaveAttribute('aria-valuemax', '5');
  });

  test('match history strip is rendered', async ({ page }) => {
    await page.goto('/players/5');

    const strip = page.getByRole('region', { name: /match history/i });
    await expect(strip).toBeVisible();

    // Gabriel seed has 14 snapshots
    const list = page.getByRole('list', { name: /match cards/i });
    await expect(list).toBeVisible();
    const items = list.getByRole('listitem');
    await expect(items.first()).toBeVisible();
    // At least 1 card is visible
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test('confidence chart is rendered', async ({ page }) => {
    await page.goto('/players/5');

    const chart = page.getByRole('region', { name: /confidence over time/i });
    await expect(chart).toBeVisible();
    // Recharts renders an SVG
    await expect(chart.locator('svg')).toBeVisible();
  });

  test('big team breakdown is rendered', async ({ page }) => {
    await page.goto('/players/5');

    const breakdown = page.getByRole('region', { name: /big team breakdown/i });
    await expect(breakdown).toBeVisible();
    await expect(breakdown.getByText('vs Big Teams')).toBeVisible();
    await expect(breakdown.getByText('vs Others')).toBeVisible();
  });

  test('latest reason is shown below the slider', async ({ page }) => {
    await page.goto('/players/5');

    // GW + delta + reason caption — format: "GW14 · 0 · Clean sheet vs non-big team"
    const heroSection = page.getByRole('region', { name: /player confidence/i });
    // Caption is only rendered when reason is non-empty and hasSnapshots
    const caption = heroSection.locator('p');
    await expect(caption).toBeVisible();
    const text = await caption.textContent();
    // Verify the GW pattern is present
    expect(text).toMatch(/GW\d+/);
  });

  test('not-found page renders for invalid player ID', async ({ page }) => {
    // Next.js 15 App Router returns 200 even for notFound() pages in the RSC layer
    await page.goto('/players/9999999');
    await expect(page.getByText(/player not found/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /back to players/i })).toBeVisible();
  });

  test('non-numeric ID returns not-found', async ({ page }) => {
    await page.goto('/players/abc');
    await expect(page.getByText(/player not found/i)).toBeVisible();
  });

  test('back link navigates to /players', async ({ page }) => {
    await page.goto('/players/5');
    await page.getByRole('link', { name: /players/i }).click();
    await expect(page).toHaveURL('/players');
  });
});
