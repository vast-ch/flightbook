// Request budget: a write followed by the return to its list must load that
// list exactly once. The store used to refetch page one after the insert and
// the list page then refetched it again on enter - correct on screen, but every
// save cost a redundant round-trip. Each test starts on the list *inside the
// running app*, the way a pilot gets there: a page.goto to the add form would
// reload the app, empty the stores and hide the double load.
import { test, expect, open, settle, api } from './fixtures';
import type { Page } from '@playwright/test';
import { API_URL, SEED } from './seed-data.js';

const run = Date.now().toString(36);

async function fill(page: Page, name: string, value: string) {
  const input = page.locator(`ion-input[name="${name}"] input, ion-textarea[name="${name}"] textarea`).first();
  await input.fill(value);
}

async function save(page: Page) {
  await page.locator('ion-button[type="submit"]').click();
  await settle(page);
}

/**
 * Counts list fetches of one collection from now on: GET on exactly that path
 * with a page size above 1. Leaves out the add form's own lookups - the latest
 * flight (`limit=1`), the glider select (no limit) - and every other endpoint
 * under the same prefix (`/flights/…/count`, `/v2/flights/statistic`).
 */
function countListRequests(page: Page, path: '/flights' | '/gliders' | '/places'): () => number {
  let count = 0;
  page.on('request', (request) => {
    if (request.method() !== 'GET') return;
    const url = new URL(request.url());
    if (url.origin !== API_URL || url.pathname !== path) return;
    if (Number(url.searchParams.get('limit') ?? 0) > 1) count++;
  });
  return () => count;
}

test.describe('flight list', () => {
  const description = `E2E flight ${run}`;

  test.afterEach(async () => {
    for (const f of await api<any[]>('GET', '/flights')) if (f.description?.startsWith('E2E flight')) await api('DELETE', `/flights/${f.id}`);
  });

  test('is loaded once after logging a flight', async ({ page, consoleErrors }) => {
    await open(page, '/flights');
    const listRequests = countListRequests(page, '/flights');

    await page.locator('.fb-tab-button--add').click();
    await page.locator('.add-sheet__row').first().click();
    await settle(page);
    await expect(page).toHaveURL(/\/flights\/add$/);
    await expect(page.locator('ion-select.glider-select')).not.toHaveJSProperty('value', undefined);
    await fill(page, 'start', SEED.places[0].name);
    await fill(page, 'km', '987');
    await fill(page, 'description', description);
    await page.keyboard.press('Escape'); // dismiss place autocomplete, if open
    await save(page);

    await expect(page).toHaveURL(/\/flights$/);
    await expect(page.getByText('987 km').first()).toBeVisible();
    const created = (await api<any[]>('GET', '/flights')).find((f) => f.description === description);
    expect(created, 'flight stored by the API').toMatchObject({ km: 987 });
    expect(listRequests()).toBe(1);
    expect(consoleErrors).toEqual([]);
  });

  test('is loaded once after moving a flight to another date', async ({ page, consoleErrors }) => {
    // Newest in the logbook, so it is the first row and needs no scrolling.
    const glider = (await api<any[]>('GET', '/gliders'))[0];
    const flight = await api<any>('POST', '/flights', { date: '2026-10-21', km: 876, description, glider });

    await open(page, '/flights');
    const listRequests = countListRequests(page, '/flights');

    await page.getByText('876 km').first().click();
    await settle(page);
    await expect(page).toHaveURL(new RegExp(`/flights/${flight.id}$`));

    await page.locator('#flightDateInput').click();
    const picker = page.locator('ion-modal.dateModal ion-datetime');
    await expect(picker).toBeVisible();
    // Tapping a wheel item scrolls it into the selection, as a pilot would.
    await picker.getByRole('button', { name: '1', exact: true }).click();
    await page.waitForTimeout(400); // the wheel settles on scroll end
    await page.locator('ion-modal.dateModal').getByRole('button', { name: 'Ok' }).click();
    await expect(page.locator('#flightDateInput')).toContainText('01.10.2026');
    await save(page);

    await expect(page).toHaveURL(/\/flights$/);
    await expect.poll(async () => (await api<any>('GET', `/flights/${flight.id}`)).date).toBe('2026-10-01');
    expect(listRequests()).toBe(1);
    expect(consoleErrors).toEqual([]);
  });

  // The store keeps no hand-patched copy of an edited flight: the edit bumps
  // the revision and the list reloads on enter. This pins down that the list
  // and a reopened edit form both show the saved values from that reload.
  test('shows an edited flight from a single reload', async ({ page, consoleErrors }) => {
    const glider = (await api<any[]>('GET', '/gliders'))[0];
    const flight = await api<any>('POST', '/flights', { date: '2026-10-21', km: 765, description, glider });

    await open(page, '/flights');
    const listRequests = countListRequests(page, '/flights');

    await page.getByText('765 km').first().click();
    await settle(page);
    await expect(page).toHaveURL(new RegExp(`/flights/${flight.id}$`));
    await fill(page, 'km', '654');
    await save(page);

    await expect(page).toHaveURL(/\/flights$/);
    await expect(page.getByText('654 km').first()).toBeVisible();
    await expect(page.getByText('765 km')).toHaveCount(0);
    expect(listRequests()).toBe(1);

    await page.getByText('654 km').first().click();
    await settle(page);
    await expect(page.locator('ion-input[name="km"] input')).toHaveValue('654');
    expect(consoleErrors).toEqual([]);
  });
});

/** Waits for the edit page's delete button, enabled once the flight count came back as 0. */
async function deleteFromEditPage(page: Page) {
  const button = page.locator('ion-button[color="danger"]');
  await expect(button).not.toHaveClass(/button-disabled/);
  await button.click();
  await settle(page);
}

test.describe('glider list', () => {
  const brand = 'E2E';
  const name = `Glider ${run}`;

  test.afterEach(async () => {
    for (const g of await api<any[]>('GET', '/gliders')) if (g.brand === brand) await api('DELETE', `/gliders/${g.id}`);
  });

  test('is loaded once after editing a glider', async ({ page, consoleErrors }) => {
    const glider = await api<any>('POST', '/gliders', { brand, name, tandem: false, archived: false });
    const renamed = `${name} renamed`;

    await open(page, '/more/gliders');
    const listRequests = countListRequests(page, '/gliders');

    await page.getByText(`${brand} ${name}`, { exact: true }).first().click();
    await settle(page);
    await expect(page).toHaveURL(new RegExp(`/more/gliders/${glider.id}$`));
    await fill(page, 'name', renamed);
    await save(page);

    await expect(page).toHaveURL(/\/more\/gliders$/);
    await expect(page.getByText(`${brand} ${renamed}`, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`${brand} ${name}`, { exact: true })).toHaveCount(0);
    expect(listRequests()).toBe(1);

    await page.getByText(`${brand} ${renamed}`, { exact: true }).first().click();
    await settle(page);
    await expect(page.locator('ion-input[name="name"] input')).toHaveValue(renamed);
    expect(consoleErrors).toEqual([]);
  });

  test('is loaded once after deleting a glider', async ({ page, consoleErrors }) => {
    const glider = await api<any>('POST', '/gliders', { brand, name, tandem: false, archived: false });

    await open(page, '/more/gliders');
    const listRequests = countListRequests(page, '/gliders');

    await page.getByText(`${brand} ${name}`, { exact: true }).first().click();
    await settle(page);
    await expect(page).toHaveURL(new RegExp(`/more/gliders/${glider.id}$`));
    await deleteFromEditPage(page);

    await expect(page).toHaveURL(/\/more\/gliders$/);
    await expect(page.getByText(`${brand} ${name}`, { exact: true })).toHaveCount(0);
    await expect(page.getByText(`${SEED.gliders[0].brand} ${SEED.gliders[0].name}`).first()).toBeVisible();
    expect((await api<any[]>('GET', '/gliders')).find((g) => g.id === glider.id)).toBeUndefined();
    expect(listRequests()).toBe(1);
    expect(consoleErrors).toEqual([]);
  });

  test('is loaded once after adding a glider', async ({ page, consoleErrors }) => {
    await open(page, '/more/gliders');
    const listRequests = countListRequests(page, '/gliders');

    await page.getByRole('button', { name: 'Add' }).click();
    await settle(page);
    await expect(page).toHaveURL(/\/more\/gliders\/add$/);
    await fill(page, 'brand', brand);
    await fill(page, 'name', name);
    await save(page);

    await expect(page).toHaveURL(/\/more\/gliders$/);
    await expect(page.getByText(name).first()).toBeVisible();
    expect(listRequests()).toBe(1);
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('place list', () => {
  const name = `E2E place ${run}`;

  test.afterEach(async () => {
    for (const p of await api<any[]>('GET', '/places')) if (p.name.startsWith('E2E place')) await api('DELETE', `/places/${p.id}`);
  });

  test('is loaded once after editing a place', async ({ page, consoleErrors }) => {
    const place = await api<any>('POST', '/places', { name, altitude: 1000, country: 'ch' });
    const renamed = `${name} renamed`;

    await open(page, '/more/places');
    const listRequests = countListRequests(page, '/places');

    await page.getByText(name, { exact: true }).first().click();
    await settle(page);
    await expect(page).toHaveURL(new RegExp(`/more/places/${place.id}$`));
    await fill(page, 'name', renamed);
    await save(page);

    await expect(page).toHaveURL(/\/more\/places$/);
    await expect(page.getByText(renamed, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
    expect(listRequests()).toBe(1);

    await page.getByText(renamed, { exact: true }).first().click();
    await settle(page);
    await expect(page.locator('ion-input[name="name"] input')).toHaveValue(renamed);
    expect(consoleErrors).toEqual([]);
  });

  test('is loaded once after deleting a place', async ({ page, consoleErrors }) => {
    const place = await api<any>('POST', '/places', { name, altitude: 1000, country: 'ch' });

    await open(page, '/more/places');
    const listRequests = countListRequests(page, '/places');

    await page.getByText(name, { exact: true }).first().click();
    await settle(page);
    await expect(page).toHaveURL(new RegExp(`/more/places/${place.id}$`));
    await deleteFromEditPage(page);

    await expect(page).toHaveURL(/\/more\/places$/);
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
    await expect(page.getByText(SEED.places[0].name, { exact: true }).first()).toBeVisible();
    expect((await api<any[]>('GET', '/places')).find((p) => p.id === place.id)).toBeUndefined();
    expect(listRequests()).toBe(1);
    expect(consoleErrors).toEqual([]);
  });

  test('is loaded once after adding a place', async ({ page, consoleErrors }) => {
    await open(page, '/more/places');
    const listRequests = countListRequests(page, '/places');

    await page.getByRole('button', { name: 'Add' }).click();
    await settle(page);
    await expect(page).toHaveURL(/\/more\/places\/add$/);
    await fill(page, 'name', name);
    await save(page);

    await expect(page).toHaveURL(/\/more\/places$/);
    await expect(page.getByText(name).first()).toBeVisible();
    expect(listRequests()).toBe(1);
    expect(consoleErrors).toEqual([]);
  });
});
