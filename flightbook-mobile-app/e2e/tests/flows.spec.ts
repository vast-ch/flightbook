// Functional flows: fill a form, save, and check the result both on screen and
// in the API. These are the checks that catch change-detection regressions
// (e.g. zoneless Angular, where a value set in an async callback silently
// never renders) — a screenshot of an empty form would not.
import { test, expect, open, settle, api } from './fixtures';
import type { Page } from '@playwright/test';
import { SEED } from './seed-data.js';

const run = Date.now().toString(36);

async function fill(page: Page, name: string, value: string) {
  const input = page.locator(`ion-input[name="${name}"] input, ion-textarea[name="${name}"] textarea`).first();
  await input.fill(value);
}

async function save(page: Page) {
  await page.locator('ion-button[type="submit"]').click();
  await settle(page);
}

test.describe('glider', () => {
  const brand = 'E2E';
  const name = `Glider ${run}`;

  test.afterEach(async () => {
    for (const g of await api<any[]>('GET', '/gliders')) if (g.brand === brand) await api('DELETE', `/gliders/${g.id}`);
  });

  test('can be created and then edited', async ({ page, consoleErrors }) => {
    await open(page, '/more/gliders/add');
    await fill(page, 'brand', brand);
    await fill(page, 'name', name);
    await save(page);

    await expect(page).toHaveURL(/\/more\/gliders$/);
    await expect(page.getByText(name).first()).toBeVisible();
    const created = (await api<any[]>('GET', '/gliders')).find((g) => g.name === name);
    expect(created, 'glider stored by the API').toBeTruthy();

    await page.getByText(`${brand} ${name}`, { exact: true }).first().click();
    await settle(page);
    await expect(page).toHaveURL(/\/more\/gliders\/\d+$/);
    // The edit form must show the stored values, not an empty form.
    await expect(page.locator('ion-input[name="name"] input')).toHaveValue(name);
    await fill(page, 'note', 'edited by e2e');
    await save(page);

    await expect.poll(async () => (await api<any[]>('GET', '/gliders')).find((g) => g.name === name)?.note).toBe('edited by e2e');
    expect(consoleErrors).toEqual([]);
  });

  test('refuses to save without the required fields', async ({ page }) => {
    await open(page, '/more/gliders/add');
    await fill(page, 'brand', brand);
    await save(page);

    await expect(page.locator('ion-alert')).toBeVisible();
    await expect(page).toHaveURL(/\/more\/gliders\/add$/);
  });
});

test.describe('place', () => {
  const name = `E2E place ${run}`;

  test.afterEach(async () => {
    for (const p of await api<any[]>('GET', '/places')) if (p.name.startsWith('E2E place')) await api('DELETE', `/places/${p.id}`);
  });

  test('can be created with altitude and country', async ({ page, consoleErrors }) => {
    await open(page, '/more/places/add');
    await fill(page, 'name', name);
    await fill(page, 'altitude', '1234');
    await page.locator('ion-select[name="country"]').click();
    await page.locator('ion-alert').getByText('Switzerland', { exact: true }).click();
    await page.locator('ion-alert').getByRole('button', { name: 'OK' }).click();
    await save(page);

    await expect(page).toHaveURL(/\/more\/places$/);
    await expect(page.getByText(name).first()).toBeVisible();
    const created = (await api<any[]>('GET', '/places')).find((p) => p.name === name);
    // The app stores lowercase ISO codes.
    expect(created).toMatchObject({ altitude: 1234, country: 'ch' });
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('flight', () => {
  const description = `E2E flight ${run}`;

  test.afterEach(async () => {
    for (const f of await api<any[]>('GET', '/flights')) if (f.description?.startsWith('E2E flight')) await api('DELETE', `/flights/${f.id}`);
  });

  test('can be logged and shows up in the list', async ({ page, consoleErrors }) => {
    await open(page, '/flights/add');
    // The glider select is preselected with the most recently used glider.
    await expect(page.locator('ion-select.glider-select')).not.toHaveJSProperty('value', undefined);
    await fill(page, 'start', SEED.places[0].name);
    await fill(page, 'km', '42');
    await fill(page, 'description', description);
    await page.keyboard.press('Escape'); // dismiss place autocomplete, if open
    await save(page);

    await expect(page).toHaveURL(/\/flights$/);
    const created = (await api<any[]>('GET', '/flights')).find((f) => f.description === description);
    expect(created, 'flight stored by the API').toMatchObject({ km: 42, date: '2026-10-22' });
    expect(created.start?.name).toBe(SEED.places[0].name);
    expect(consoleErrors).toEqual([]);
  });
});
