import { test as base, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { PG_CONTAINER } from './seed-data.js';

const AUTH = new URL('../.auth/', import.meta.url);

export function token(): string {
  const f = new URL('token.txt', AUTH);
  if (!fs.existsSync(f)) throw new Error('No e2e token — run `npm run stack:up` first.');
  return fs.readFileSync(f, 'utf8').trim();
}

export const schoolId = (): number => Number(fs.readFileSync(new URL('school.txt', AUTH), 'utf8').trim());

/** Runs SQL against the e2e Postgres (test setup, assertions, cleanup). */
export const psql = (sql: string): string =>
  execFileSync('docker', ['exec', PG_CONTAINER, 'psql', '-U', 'fb', '-d', 'flightbook_test', '-tAqc', sql], { encoding: 'utf8' }).trim();

/** True for the student-list request the appointments page fires on load. */
export const isStudentsRequest = (url: URL) => /\/instructor\/schools\/\d+\/students$/.test(url.pathname);

export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(`Uncaught: ${e.message}`));
    await use(errors);
  },

  page: async ({ page }, use) => {
    // Nothing leaves the machine.
    await page.route(/^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/])/, (route) => route.abort('blockedbyclient'));
    await page.addInitScript((t) => {
      localStorage.setItem('language', 'de');
      localStorage.setItem('access_token', t);
    }, token());
    await use(page);
  },
});

export async function waitForAppointments(page: Page) {
  await expect(page.getByRole('button', { name: 'Termin bearbeiten' }).first()).toBeVisible({ timeout: 15_000 });
}

export { expect };
