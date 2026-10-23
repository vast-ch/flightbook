import { test, expect, open, settle } from './fixtures';
import { SEED } from './seed-data.js';

type Route = {
  name: string;
  path: string;
  /** Text that proves the screen rendered its data, not just its shell. */
  shows?: string;
  /** Reach the screen by clicking these, in order (text, or a `css=` selector), after loading `path`. */
  via?: string | string[];
  /** The screen is a modal over `path`: skip the open-a-select step behind it. */
  modal?: boolean;
  /** Where the app should end up (defaults to `path`). */
  lands?: RegExp;
  loggedOut?: boolean;
  /** Console errors that are known, pre-existing bugs — not regressions. */
  knownErrors?: RegExp[];
};

const [iota] = SEED.gliders;
const [niederbauen] = SEED.places;
const { school } = SEED;

const routes: Route[] = [
  { name: 'home', path: '/home' },
  { name: 'flights', path: '/flights', shows: 'Niederbauen' },
  { name: 'flights-add', path: '/flights/add', shows: 'Log a flight' },
  { name: 'flight-edit', path: '/flights', via: 'css=ion-item.flight-row', lands: /\/flights\/\d+$/ },
  { name: 'statistics', path: '/statistics' },
  { name: 'more', path: '/more' },
  { name: 'gliders', path: '/more/gliders', shows: iota.name },
  { name: 'gliders-add', path: '/more/gliders/add' },
  // Edit pages take their entity from router state; a deep link bounces back
  // to the list, so open them the way a user does.
  { name: 'glider-edit', path: '/more/gliders', via: `${iota.brand} ${iota.name}`, lands: /\/more\/gliders\/\d+$/ },
  { name: 'places', path: '/more/places', shows: niederbauen.name },
  { name: 'places-add', path: '/more/places/add' },
  { name: 'place-edit', path: '/more/places', via: niederbauen.name, lands: /\/more\/places\/\d+$/ },
  { name: 'imports-igc', path: '/flights/imports/igc' },
  { name: 'imports-data', path: '/more/imports/data' },
  { name: 'settings', path: '/settings', shows: SEED.user.email },
  // School: the seeded user is a student and tandem pilot of SEED.school.
  // With a single school, More names it in the section label and the row
  // itself reads "Appointments".
  { name: 'school-appointments', path: '/more', via: 'Appointments', lands: /\/more\/school\/\d+$/, shows: school.appointmentType },
  {
    name: 'appointment-detail',
    path: '/more',
    via: ['Appointments', 'css=button.appt-row__open'],
    lands: /\/more\/school\/\d+$/,
    shows: 'Bring your own glider.',
    modal: true,
  },
  // A user *without* a control sheet makes ControlSheetPage.orderControlSheet()
  // dereference null ("reading 'altitudeFlight'") — pre-existing, not covered
  // here because the seeded user has a sheet.
  { name: 'control-sheet', path: '/more/control-sheet' },
  { name: 'control-sheet-skill', path: '/more/control-sheet', via: 'css=button.sheet-skill', modal: true },
  { name: 'passenger-confirmations', path: '/more/passenger-confirmations', shows: school.passengers[0].lastname },
  {
    name: 'passenger-confirmation-detail',
    path: '/more/passenger-confirmations',
    via: 'css=button.confirm-row',
    modal: true,
  },
  { name: 'login', path: '/login', loggedOut: true },
  { name: 'register', path: '/register', loggedOut: true },
];

for (const r of routes) {
  test.describe(r.name, () => {
    if (r.loggedOut) test.use({ loggedIn: false });

    test('renders without errors and matches the baseline', async ({ page, consoleErrors }) => {
      await open(page, r.path);
      for (const via of [r.via ?? []].flat()) {
        const target = via.startsWith('css=') ? page.locator(via.slice(4)) : page.getByText(via, { exact: true });
        await target.first().click();
        await settle(page);
      }

      const lands = r.lands ?? new RegExp(`${r.path.replace(/\//g, '\\/')}$`);
      expect(new URL(page.url()).pathname, 'stayed on the screen (no redirect to login/list)').toMatch(lands);
      if (r.shows) await expect(page.getByText(r.shows, { exact: false }).first()).toBeVisible();

      await expect(page).toHaveScreenshot(`${r.name}.png`);

      // Ionic scrolls inside ion-content, so a full-page capture can't reach
      // what is below the fold — scroll it and take a second shot instead.
      const content = page.locator('ion-content:visible').last();
      const scrolls = await content
        .evaluate(async (el: any) => {
          const s = await el.getScrollElement();
          return s.scrollHeight > s.clientHeight + 1;
        })
        .catch(() => false);
      if (scrolls) {
        await content.evaluate((el: any) => el.scrollToBottom(0));
        await settle(page);
        await expect(page).toHaveScreenshot(`${r.name}--bottom.png`);
        await content.evaluate((el: any) => el.scrollToTop(0));
        await settle(page);
      }

      // The first select on the screen, opened: covers alert / popover /
      // action-sheet overlays, whose internals changed in Ionic 9.
      const select = page.locator('ion-select:visible').first();
      if (!r.modal && (await select.count())) {
        await select.click();
        await page.locator('ion-alert, ion-popover, ion-action-sheet, ion-modal').last().waitFor();
        // Ionic moves focus into the overlay a beat after presenting it; a
        // screenshot taken before that races the focus ring / highlight.
        await page.waitForFunction(() =>
          document.activeElement?.closest('ion-alert, ion-popover, ion-action-sheet, ion-modal'),
        );
        await settle(page);
        await expect(page).toHaveScreenshot(`${r.name}--select-open.png`);
      }

      const unexpected = consoleErrors.filter((e) => !(r.knownErrors ?? []).some((k) => k.test(e)));
      expect(unexpected, 'console errors').toEqual([]);
    });
  });
}
