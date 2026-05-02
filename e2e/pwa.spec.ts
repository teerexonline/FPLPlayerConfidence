import { expect, test } from '@playwright/test';

/**
 * PWA Phase 5 — installability verification.
 *
 * These tests verify the four externally-observable contracts that make
 * the app installable as a PWA:
 *   1. Web App Manifest served with correct content-type and required fields
 *   2. Icon routes return PNG images
 *   3. Service worker registers and controls pages
 *   4. Cron API routes bypass the service worker (network-only)
 *   5. /offline page renders correctly as a standalone fallback
 */

test.describe('PWA manifest', () => {
  test('manifest.webmanifest returns 200 with correct content-type', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/manifest+json');
  });

  test('manifest.webmanifest contains required PWA fields', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    const body = (await res.json()) as Record<string, unknown>;

    expect(body['name']).toBeTruthy();
    expect(body['short_name']).toBeTruthy();
    expect(body['start_url']).toBe('/');
    expect(body['display']).toBe('standalone');
    expect(body['icons']).toBeInstanceOf(Array);

    const icons = body['icons'] as { src: string; sizes: string; purpose?: string }[];
    expect(icons.length).toBeGreaterThanOrEqual(3);

    const has192 = icons.some((i) => i.sizes === '192x192');
    const has512 = icons.some((i) => i.sizes === '512x512' && i.purpose === 'any');
    const hasMaskable = icons.some((i) => i.purpose === 'maskable');
    expect(has192).toBe(true);
    expect(has512).toBe(true);
    expect(hasMaskable).toBe(true);
  });
});

test.describe('PWA icons', () => {
  for (const path of ['/icon/192', '/icon/512', '/apple-icon', '/icon-maskable']) {
    test(`${path} returns 200 image/png`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toContain('image/png');
    });
  }
});

test.describe('PWA service worker', () => {
  // Run SW tests serially — each navigation triggers SW installation
  // which precaches 6 routes, causing contention under parallel load.
  test.describe.configure({ mode: 'serial' });

  test('service worker registers and controls page after activation', async ({ page }) => {
    await page.goto('/');

    // Chain on navigator.serviceWorker.ready (resolves when an active worker
    // exists), then wait for clients.claim() to fire controllerchange.
    const controlled = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const done = (value: boolean) => {
            resolve(value);
          };
          const timeout = setTimeout(() => {
            done(false);
          }, 20_000);

          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          navigator.serviceWorker.ready.then(() => {
            if (navigator.serviceWorker.controller) {
              clearTimeout(timeout);
              done(true);
              return;
            }
            // clients.claim() fires 'controllerchange' on existing clients.
            navigator.serviceWorker.addEventListener('controllerchange', () => {
              clearTimeout(timeout);
              done(true);
            });
          });
        }),
    );

    expect(controlled).toBe(true);
  });

  test('cron API routes bypass the service worker', async ({ page, context }) => {
    // Set up the network interceptor before navigating so it's in place
    // for any requests made during navigation.
    let cronReachedNetwork = false;
    await context.route('**/api/cron/**', (route) => {
      cronReachedNetwork = true;
      // Reply with 401 so no real cron work runs in tests.
      void route.fulfill({ status: 401, body: 'test-intercept' });
    });

    await page.goto('/');

    // Fetch a cron URL. Whether or not the SW is controlling:
    //   - If SW controls + bypasses: request goes directly to network → intercepted.
    //   - If SW not yet controlling: request goes directly to network → intercepted.
    // Either way the request must reach the network. If SW were to intercept
    // cron routes and serve from cache, cronReachedNetwork would stay false.
    await page.evaluate(() => fetch('/api/cron/sync').catch(() => undefined));
    // Small grace period for the route handler to fire.
    await page.waitForTimeout(200);

    expect(cronReachedNetwork).toBe(true);
  });
});

test.describe('PWA offline page', () => {
  test('/offline renders the offline fallback content', async ({ page }) => {
    await page.goto('/offline');
    await expect(page.getByText("You're offline.")).toBeVisible();
    await expect(page.getByText(/Confidence numbers update/i)).toBeVisible();
  });
});
