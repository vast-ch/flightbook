import { test as base, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { API_URL } from './seed-data.js';

const TOKEN_FILE = new URL('../.auth/token.txt', import.meta.url);
const BLANK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

export function token(): string {
  if (!fs.existsSync(TOKEN_FILE)) throw new Error('No e2e token — run `npm run stack:up` first.');
  return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
}

/** Calls flightbook-api as the seeded user (for setup, lookups and cleanup). */
export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(API_URL + path, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

type Fixtures = {
  /** Set to false for screens that must be visited logged out. */
  loggedIn: boolean;
  /**
   * 'fixed' freezes Date.now() for stable screenshots. RxJS debounceTime waits
   * for Date.now() to pass its deadline, so under a frozen clock a debounced
   * stream never emits: specs exercising debounced UI use 'running', which
   * starts at the same instant and then ticks normally.
   */
  clock: 'fixed' | 'running';
  /** Console errors and uncaught exceptions collected during the test. */
  consoleErrors: string[];
};

export const test = base.extend<Fixtures>({
  loggedIn: [true, { option: true }],
  clock: ['fixed', { option: true }],

  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(`Uncaught: ${e.message}`));
    await use(errors);
  },

  page: async ({ page, loggedIn, clock }, use) => {
    // Nothing leaves the machine: map tiles (OpenStreetMap) and any other
    // external request would make screenshots slow, flaky and dependent on
    // someone else's server. Images get a transparent pixel, the rest fails.
    await page.route(/^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/])/, (route) =>
      route.request().resourceType() === 'image'
        ? route.fulfill({ contentType: 'image/png', body: BLANK_PNG })
        : route.abort('blockedbyclient'),
    );
    // A fixed clock keeps "today" (date pickers, default flight date) stable
    // between the baseline run and the run under test.
    const now = new Date('2026-10-22T10:00:00+02:00');
    if (clock === 'fixed') await page.clock.setFixedTime(now);
    else await page.clock.setSystemTime(now);
    await page.addInitScript(
      ([t, loggedIn]) => {
        localStorage.setItem('language', 'en');
        if (loggedIn) localStorage.setItem('access_token', t as string);
        (window as any).Ionic = { config: { animated: false } };
      },
      [token(), loggedIn] as const,
    );
    await use(page);
  },
});

/** Navigates and waits until the app has rendered and stopped fetching. */
export async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'load' });
  // The boot screen stays up at least 900 ms after the first page activates
  // (AppComponent.MIN_BOOT_MS) - ~1.5 s after load. A light screen (register)
  // can go network-idle sooner, and with animations disabled the boot screen is
  // a "stable" frame toHaveScreenshot will happily compare.
  await page.locator('fb-loading-screen').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {});
  await settle(page);
}

export async function settle(page: Page) {
  // Capped: a cold first load once kept the network busy past the whole test
  // timeout. Anything that matters is asserted on afterwards anyway.
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  // Ionic hydrates components and fonts land a beat after networkidle.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

/**
 * Screenshot against the baseline — skipped in the change-detection run
 * (`npm run test:cd`), which serves a dev-mode build: that run is about NG0100
 * console errors, and its unoptimised bundle is not what baselines are made of.
 */
export async function shot(page: Page, name: string) {
  if (process.env.E2E_CD_CHECK) return;
  await expect(page).toHaveScreenshot(name);
}

export { expect };
