import { test as base, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { API_URL } from './seed-data.js';

const TOKEN_FILE = new URL('../.auth/token.txt', import.meta.url);

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
  /** Console errors and uncaught exceptions collected during the test. */
  consoleErrors: string[];
};

export const test = base.extend<Fixtures>({
  loggedIn: [true, { option: true }],

  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(`Uncaught: ${e.message}`));
    await use(errors);
  },

  page: async ({ page, loggedIn }, use) => {
    // A fixed clock keeps "today" (date pickers, default flight date) stable
    // between the baseline run and the run under test.
    await page.clock.setFixedTime(new Date('2026-10-22T10:00:00+02:00'));
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
  await page.goto(path, { waitUntil: 'networkidle' });
  await settle(page);
}

export async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  // Ionic hydrates components and fonts land a beat after networkidle.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

export { expect };
