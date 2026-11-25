// Interactions whose result arrives asynchronously - after a debounce, an HTTP
// answer, a Web Worker message, an overlay closing, an infinite-scroll page.
// These are where a zoneless / OnPush migration breaks: a plain field written
// in such a callback no longer schedules a render, and the screen stays stale.
//
// Each test triggers the action and then asserts on screen *without clicking
// anything in between*: a click is itself a change-detection trigger and would
// paint over exactly the bug these are meant to catch. Run them through
// `npm run test:cd` as well, where unnotified changes also log NG0100.
import { test, expect, open, api } from './fixtures';
import type { Page } from '@playwright/test';
import { SEED } from './seed-data.js';

const run = Date.now().toString(36);

// Debounced streams (filter count, place autocomplete) need a clock that moves.
test.use({ clock: 'running' });
const [iota, hook] = SEED.gliders;
const IGC_FILE = new URL('./files/flight.igc', import.meta.url).pathname;

/** Flights whose description starts with `prefix` are this spec's; removed after each test. */
async function deleteFlights(prefix: string) {
  for (const f of await api<any[]>('GET', '/flights')) if (f.description?.startsWith(prefix)) await api('DELETE', `/flights/${f.id}`);
}

async function createFlight(flight: Record<string, unknown>) {
  const glider = (await api<any[]>('GET', '/gliders')).find((g) => g.name === iota.name);
  return api<any>('POST', '/flights', { glider, shvAlone: false, ...flight });
}

const rows = (page: Page) => page.locator('ion-item.flight-row');
const eyebrow = (page: Page) => page.locator('.list-header__eyebrow .fb-section-label');

async function openFilterSheet(page: Page) {
  await page.locator('.list-header__actions button[aria-label="Filter"]').click();
  const sheet = page.locator('ion-modal.fb-filter-sheet');
  await expect(sheet.getByText('Filter flights')).toBeVisible();
  return sheet;
}

test.describe('flight filter', () => {
  test('by glider: counts matches, filters the list, and the chip clears it', async ({ page, consoleErrors }) => {
    await open(page, '/flights');
    await expect(rows(page)).toHaveCount(SEED.flightCount);

    const sheet = await openFilterSheet(page);
    await sheet.locator('ion-select[name="glider"]').click();
    const alert = page.locator('ion-alert');
    await alert.getByText(`${hook.brand} ${hook.name}`, { exact: true }).click();
    await alert.getByRole('button', { name: 'Ok' }).click();

    // matchCount comes from a debounced statistics request.
    const half = SEED.flightCount / 2;
    const show = sheet.getByRole('button', { name: `Show ${half} flights` });
    await expect(show).toBeVisible();
    await show.click();

    await expect(rows(page)).toHaveCount(half);
    await expect(page.locator('.flight-row__glider').filter({ hasText: iota.name })).toHaveCount(0);
    await expect(page.locator('.list-header__chip')).toHaveText('filtered');

    await page.locator('.filter-summary .fb-chip--removable').filter({ hasText: hook.name }).click();
    await expect(rows(page)).toHaveCount(SEED.flightCount);
    await expect(page.locator('.list-header__chip')).toHaveCount(0);
    expect(consoleErrors).toEqual([]);
  });

  test('by date: a "from" past every flight shows the empty state', async ({ page, consoleErrors }) => {
    await open(page, '/flights');
    const sheet = await openFilterSheet(page);

    // Confirming the picker untouched takes "today" (the test clock, 2026-10-22), which is
    // after every seeded flight.
    await sheet.locator('#filterFrom').click();
    const picker = page.locator('ion-modal.filterDateModal ion-datetime');
    await expect(picker).toBeVisible();
    await picker.getByRole('button', { name: 'Ok' }).click();

    await expect(sheet.locator('#filterFrom .filter-date__value')).toHaveText('22.10.2026');
    const show = sheet.getByRole('button', { name: 'Show 0 flights' });
    await expect(show).toBeVisible();
    await show.click();

    await expect(page.getByText('No flights match')).toBeVisible();
    await expect(rows(page)).toHaveCount(0);

    await page.locator('.filter-empty__action').click();
    await expect(rows(page)).toHaveCount(SEED.flightCount);
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('statistics', () => {
  const description = `E2E stats ${run}`;
  test.afterEach(() => deleteFlights('E2E stats'));

  test('switching the period reloads headline and chart', async ({ page, consoleErrors }) => {
    await createFlight({ date: '2025-06-10', km: 11, time: '00:30:00', description });
    const total = SEED.flightCount + 1;

    await open(page, '/statistics');
    const kicker = page.locator('.stat-header .fb-section-label');
    const headline = page.locator('.headline__cell').first().locator('.fb-stat__value');
    await expect(kicker).toHaveText(`All time · ${total} flights since 2025`);
    await expect(headline).toHaveText(String(total));
    await expect(page.getByText('Flights per year')).toBeVisible();

    await page.locator('.period__scroll .fb-chip', { hasText: '2025' }).click();
    await expect(kicker).toHaveText('2025 season · 1 flights');
    await expect(headline).toHaveText('1');
    await expect(page.getByText('Flights per month')).toBeVisible();

    await page.locator('.period__scroll .fb-chip', { hasText: '2026' }).click();
    await expect(kicker).toHaveText(`2026 season · ${SEED.flightCount} flights`);
    await expect(headline).toHaveText(String(SEED.flightCount));

    await page.locator('.period__pinned .fb-chip').click();
    await expect(kicker).toHaveText(`All time · ${total} flights since 2025`);
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('IGC import', () => {
  // Staging only: saving uploads to S3 through a presigned URL, which the local
  // stack cannot provide.
  test('stages a parsed file (worker result) and removes it again', async ({ page, consoleErrors }) => {
    await open(page, '/flights/imports/igc');
    await page.locator('fb-file-input input[type="file"]').setInputFiles(IGC_FILE);

    // File.text() → igc-parser → xc-score Web Worker → plain fields on the page.
    await expect(page.getByText('1 flight ready')).toBeVisible();
    const row = page.locator('.igc-row').first();
    await expect(row.locator('ion-spinner')).toHaveCount(0);
    await expect(row.locator('.igc-row__place')).toHaveText('E2E IGC Launch');
    await expect(row.locator('.row-date__day')).toHaveText('15');
    await expect(row.locator('.igc-row__meta')).toContainText('2026');
    await expect(row.locator('.igc-row__meta')).toContainText('00:17');
    await expect(row.locator('.igc-row__meta')).toContainText('5.71 km');

    await row.locator('.igc-row__delete').click();
    await expect(page.locator('.igc-row')).toHaveCount(0);
    await expect(page.getByText('1 flight ready')).toHaveCount(0);
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('IGC prefill', () => {
  // The add page writes the parse result into its flight in place; the OnPush
  // form only shows it because the page then hands it a new object.
  test('fills the flight form from a dropped file', async ({ page, consoleErrors }) => {
    await open(page, '/flights/add');
    await page.locator('fb-file-input input[type="file"]').setInputFiles(IGC_FILE);

    await expect(page.locator('ion-input[name="km"] input')).toHaveValue('5.71');
    await expect(page.locator('ion-input[name="start"] input')).toHaveValue('E2E IGC Launch');
    await expect(page.locator('#flightDateInput .fb-row__value')).toHaveText('15.08.2026');
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('place autocomplete', () => {
  test('suggests places as you type and fills the one picked', async ({ page, consoleErrors }) => {
    const fiesch = SEED.places[2].name;
    await open(page, '/flights/add');

    // Debounced HTTP lookup → plain `show` / `listElement` fields.
    await page.locator('ion-input[name="landing"] input').pressSequentially('Fie', { delay: 50 });
    const suggestion = page.locator('.suggestion').filter({ hasText: fiesch });
    await expect(suggestion).toBeVisible();

    await suggestion.click();
    await expect(page.locator('ion-input[name="landing"] input')).toHaveValue(fiesch);
    await expect(page.locator('.suggestions')).toHaveCount(0);
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('flight list', () => {
  const description = `E2E list ${run}`;
  test.afterEach(() => deleteFlights('E2E list'));

  test('swipe-delete removes the row and updates the total', async ({ page, consoleErrors }) => {
    const flight = await createFlight({ date: '2026-10-20', km: 777, description });

    await open(page, '/flights');
    await expect(eyebrow(page)).toContainText(`${SEED.flightCount + 1} flights`);
    const sliding = page.locator('ion-item-sliding').filter({ hasText: '777 km' });
    await sliding.evaluate((el: any) => el.open('end'));
    await sliding.locator('ion-item-option').click();

    await expect(page.getByText('777 km')).toHaveCount(0);
    await expect(eyebrow(page)).toContainText(`${SEED.flightCount} flights`);
    await expect.poll(async () => (await api<any[]>('GET', '/flights')).some((f) => f.id === flight.id)).toBe(false);
    expect(consoleErrors).toEqual([]);
  });

  test('infinite scroll appends the next page', async ({ page, consoleErrors }) => {
    // 12 seeded + 20 here = 32, past the first page of 25. These are older
    // than every seeded flight, so the oldest of them is on the second page.
    for (let i = 0; i < 20; i++) {
      await createFlight({ date: `2025-01-${String(i + 1).padStart(2, '0')}`, km: 901 + i, description });
    }

    await open(page, '/flights');
    await expect(rows(page)).toHaveCount(25);
    await expect(page.getByText('901 km')).toHaveCount(0);

    await page.locator('ion-content:visible').last().evaluate((el: any) => el.scrollToBottom(0));
    await expect(rows(page)).toHaveCount(SEED.flightCount + 20);
    await expect(page.getByText('901 km')).toBeAttached();
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('settings', () => {
  // The language lives in localStorage, which every test starts with as 'en'.
  test('switching the language relabels the screen', async ({ page, consoleErrors }) => {
    await open(page, '/settings');
    await expect(page.getByText('Language', { exact: true })).toBeVisible();

    await page.locator('.fb-segments__item', { hasText: 'German' }).click();
    await expect(page.getByText('Sprache', { exact: true })).toBeVisible();
    await expect(page.locator('.fb-segments__item', { hasText: 'Deutsch' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.fb-segments__item', { hasText: 'Englisch' })).toHaveAttribute('aria-pressed', 'false');
    expect(consoleErrors).toEqual([]);
  });
});
