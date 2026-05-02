# E2E Test Gotchas

Hard-won lessons from `scripts/smoke-test-auth-e2e.mjs`. Add an entry whenever you hit an
issue that took more than one attempt to diagnose.

---

## 1. Supabase email validator rejects unknown TLDs

`supabase.auth.signUp()` validates the email domain using a server-side allowlist. Domains
without real MX records (including `.dev`, `.test`, `.local`, any invented TLD) return:

```
Email address is invalid
```

**Fix:** Use `mailinator.com` — it has real MX records and is accepted. Do not use made-up
domains like `fpltool-test.dev` or `example.test`.

```js
const USER_A_EMAIL = `smoke-a-${Date.now()}@mailinator.com`;
```

---

## 2. Dev email rate limit: 3 emails per hour

Supabase development projects cap outbound confirmation emails at **3 per hour**. The error
message is:

```
email rate limit exceeded
```

**Fix:** Write tests so they tolerate this. In section (b) (Signup state), assert that either
"check your email" appears OR the rate-limit error appears — both are acceptable outcomes
because the user will be created via admin API in section (c) regardless:

```js
const checkEmail = (await page.getByText(/check your email/i).count()) > 0;
const rateLimited = panelErr.toLowerCase().includes('rate limit');
assert('state appears (or rate-limited)', checkEmail || rateLimited);
```

Do **not** rely on the confirmation email flow being reachable in CI; always create the
confirmed user via `admin.auth.admin.generateLink({ type: 'signup', ... })`.

---

## 3. Auth confirmation URL auto-logs the user in via hash token

When you visit a Supabase confirmation URL (`/auth/v1/verify?token=...`), Supabase redirects
to your site with a URL hash containing an access token:

```
https://your-app.com/#access_token=...&type=signup
```

The `@supabase/ssr` client detects this hash and automatically creates a session. By the
time Playwright's `page.goto()` resolves, the user may already be signed in — even without
filling the sign-in form.

**Fix:** After visiting the confirmation link, check for the sign-out button before assuming
the user is not signed in:

```js
const alreadyIn = (await page.locator('button[aria-label="Sign out"]').count()) > 0;
if (alreadyIn) {
  // hash-based auto-login succeeded — skip form sign-in
} else {
  await signIn(page, email, password);
}
```

---

## 4. Check for the sign-out button, not the absence of "Sign in"

The auth panel uses a Radix UI Sheet component. Its content remains in the DOM even when
the sheet is closed (Radix keeps it mounted for animation). This means `button` elements
with text "Sign in" are always present in the DOM (as panel tab labels), regardless of auth
state.

**Do NOT use:**

```js
// ✗ Always finds the panel's "Sign in" tab — false negative
await page.locator('button').filter({ hasText: 'Sign in' }).first();
```

**Use instead:**

```js
// ✓ Only present when authenticated
(await page.locator('button[aria-label="Sign out"]').count()) > 0;
```

Similarly in the `signIn()` helper, wait for the sign-out button to confirm auth succeeded
rather than using a fixed timeout:

```js
await page.waitForSelector('button[aria-label="Sign out"]', { timeout: 10000 }).catch(() => {});
```

---

## 5. `user_profiles` row may not exist immediately after rate-limited signup

When email rate limiting prevents the confirmation flow from running,
`createUserProfileAction` (which fires client-side after confirmation) never runs. The
test creates the user via admin API but still needs a `user_profiles` row.

**Fix:** Pre-seed the row via direct SQL before asserting on it:

```js
await sql`
  INSERT INTO user_profiles (user_id, fpl_manager_id, display_name)
  VALUES (${userId}, NULL, NULL)
  ON CONFLICT (user_id) DO NOTHING
`.catch(() => {});
```

Then poll for up to 5 seconds in case of async write lag:

```js
let rows = [];
for (let i = 0; i < 5; i++) {
  rows = await sql`SELECT * FROM user_profiles WHERE user_id = ${userId}`;
  if (rows.length > 0) break;
  await new Promise((r) => setTimeout(r, 1000));
}
```

---

## 6. WatchlistCard `isAuthenticated` is server-baked — re-navigate after sign-in

The dashboard's `WatchlistCard` receives `isAuthenticated` as a server-rendered RSC prop
computed at request time. A client-side sign-in does not refresh this prop.

To test any flow that depends on the authenticated dashboard state (watchlist content,
sign-in CTA), navigate away and back after signing in:

```js
await goto(page, '/');
await signIn(page, email, password);
await goto(page, '/'); // fresh RSC render with auth cookie
await page.waitForTimeout(1500);
// Now isAuthenticated === true in the server-rendered output
```

---

## 7. `locator.getByRole` in strict mode matches multiple elements

Playwright's `getByRole('button', { name: /^sign in$/i })` (strict mode) throws if it
matches more than one element. The topbar, hero CTA, panel tab, and submit button may all
match "Sign in" text.

**Fix:** Use `.first()` to select the first matching element, or use `button[type="submit"]`
to target the form submit specifically.
