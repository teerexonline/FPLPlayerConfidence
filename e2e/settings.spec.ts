// TODO: Manual E2E run required — automated bash environment in dev session was
// unable to run Playwright. Verify before any merge:
//   npm run test:e2e -- --project=chromium e2e/settings.spec.ts

import { expect, test } from '@playwright/test';

/**
 * Settings page E2E.
 *
 * Server action (triggerSync) is exercised by intercepting the POST to /settings
 * and aborting it — this drives the full client state machine through
 * loading → error without needing to reproduce the RSC wire encoding.
 * The "real sync" path is verified separately via the SQL diagnostic and
 * manual dev-server verification (see checkpoint (b) notes).
 */

test.beforeEach(async ({ context }) => {
  // Clear localStorage before each test so team connection state is predictable.
  await context.addInitScript(() => {
    localStorage.removeItem('fpl-team-id');
  });
});

// ── Page structure ────────────────────────────────────────────────────────────

test('all three sections are visible on load', async ({ page }) => {
  await page.goto('/settings');

  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();

  // Section headings (uppercase via CSS, so match case-insensitively)
  await expect(page.getByText(/appearance/i).first()).toBeVisible();
  await expect(page.getByText(/^data$/i).first()).toBeVisible();
  await expect(page.getByText(/my team/i).first()).toBeVisible();

  // Appearance section — three radio options
  await expect(page.getByRole('radio', { name: /system/i })).toBeVisible();
  await expect(page.getByRole('radio', { name: /light/i })).toBeVisible();
  await expect(page.getByRole('radio', { name: /dark/i })).toBeVisible();

  // Data section — Refresh button
  await expect(page.getByRole('button', { name: 'Refresh data' })).toBeVisible();

  // My Team section — disconnected state (no localStorage)
  await expect(page.getByText(/no team connected/i)).toBeVisible();
});

// ── Theme selector ────────────────────────────────────────────────────────────

test('toggling theme radio updates the data-theme attribute on <html>', async ({ page }) => {
  await page.goto('/settings');

  // System is selected by default (next-themes default).
  const systemRadio = page.getByRole('radio', { name: /system/i });
  await expect(systemRadio).toBeChecked();

  // Click the label element (the radio input is sr-only and covered by the
  // custom indicator span — clicking the label is the correct interaction).
  await page.locator('label', { hasText: /^Dark/ }).click();
  await expect(page.getByRole('radio', { name: /dark/i })).toBeChecked();
  const htmlTheme = await page.locator('html').getAttribute('data-theme');
  expect(htmlTheme).toBe('dark');

  await page.locator('label', { hasText: /^Light/ }).click();
  await expect(page.getByRole('radio', { name: /light/i })).toBeChecked();
  const htmlThemeLight = await page.locator('html').getAttribute('data-theme');
  expect(htmlThemeLight).toBe('light');
});

// ── Refresh data button — state machine ───────────────────────────────────────

test('Refresh data: shows loading state immediately on click', async ({ page }) => {
  // Intercept the server action POST and abort it to keep tests fast.
  // Next.js server actions are sent as POST to the page's own URL.
  await page.route('/settings', async (route) => {
    if (route.request().method() === 'POST') {
      // Small delay so we can observe the loading state before abort.
      await new Promise((r) => setTimeout(r, 150));
      await route.abort('connectionrefused');
    } else {
      await route.continue();
    }
  });

  await page.goto('/settings');

  const refreshBtn = page.getByRole('button', { name: 'Refresh data' });
  await expect(refreshBtn).toBeVisible();
  await refreshBtn.click();

  // Immediately enters loading state.
  await expect(page.getByRole('button', { name: 'Syncing…' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Syncing…' })).toBeDisabled();
});

test('Refresh data: shows error state after network failure', async ({ page }) => {
  await page.route('/settings', async (route) => {
    if (route.request().method() === 'POST') {
      await route.abort('connectionrefused');
    } else {
      await route.continue();
    }
  });

  await page.goto('/settings');

  await page.getByRole('button', { name: 'Refresh data' }).click();

  // After abort, the catch block fires and shows an inline error.
  // Scoped to avoid matching Next.js's route announcer (which also has role=alert).
  await expect(page.getByText('Network error. Please try again.')).toBeVisible({ timeout: 5000 });
  // Button returns to idle.
  await expect(page.getByRole('button', { name: 'Refresh data' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh data' })).not.toBeDisabled();
});

// ── My Team section — connected vs disconnected ───────────────────────────────

test('shows connected state when team ID is in localStorage', async ({ page }) => {
  // Seed localStorage before the page mounts.
  await page.addInitScript(() => {
    localStorage.setItem('fpl-team-id', '231177');
  });

  await page.goto('/settings');

  await expect(page.getByText('231177')).toBeVisible();
  await expect(page.getByRole('link', { name: /view team/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^disconnect$/i })).toBeVisible();
  // Disconnected copy should not appear.
  await expect(page.getByText(/no team connected/i)).not.toBeVisible();
});

test('shows disconnected state when no team ID in localStorage', async ({ page }) => {
  await page.goto('/settings');

  await expect(page.getByText(/no team connected/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /connect a team/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /disconnect/i })).not.toBeVisible();
});

test('Disconnect: two-step confirmation flow clears localStorage and redirects', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('fpl-team-id', '231177');
  });

  await page.goto('/settings');

  // First click — enter confirming state.
  await expect(page.getByRole('button', { name: /^disconnect$/i })).toBeVisible();
  await page.getByRole('button', { name: /^disconnect$/i }).click();

  // Button label changes, Cancel appears, localStorage still intact.
  await expect(page.getByRole('button', { name: /confirm disconnect/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
  const storedMid = await page.evaluate(() => localStorage.getItem('fpl-team-id'));
  expect(storedMid).toBe('231177');

  // Second click — confirm.
  await page.getByRole('button', { name: /confirm disconnect/i }).click();

  // localStorage cleared.
  const stored = await page.evaluate(() => localStorage.getItem('fpl-team-id'));
  expect(stored).toBeNull();

  // Redirected to dashboard.
  await expect(page).toHaveURL('/');
});

test('Disconnect: Cancel restores the idle state without clearing localStorage', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('fpl-team-id', '231177');
  });

  await page.goto('/settings');

  await page.getByRole('button', { name: /^disconnect$/i }).click();
  await expect(page.getByRole('button', { name: /confirm disconnect/i })).toBeVisible();

  await page.getByRole('button', { name: /cancel/i }).click();

  // Back to normal disconnect label.
  await expect(page.getByRole('button', { name: /^disconnect$/i })).toBeVisible();
  // localStorage untouched.
  const stored = await page.evaluate(() => localStorage.getItem('fpl-team-id'));
  expect(stored).toBe('231177');
});
