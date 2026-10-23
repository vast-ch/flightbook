# flightbook-mobile-app e2e

Playwright tests that run the **built** mobile app against a **real, local
flightbook-api** with seeded data. Made for upgrades (Ionic, Angular, …) where
the question is "does everything still look and behave the same?".

- `tests/routes.spec.ts` — every screen: loads without console errors, stays on
  its URL, shows its data, and matches a screenshot baseline. Also screenshots
  the screen scrolled to the bottom and with its first `ion-select` open.
- `tests/flows.spec.ts` — create/edit a glider, create a place, log a flight;
  checked on screen *and* in the API. These catch change-detection breakage a
  screenshot can't (e.g. zoneless Angular). They clean up what they create.

Screens are captured as an **iPhone 16e** (390×844 pt @3x) in Chrome, so Ionic
runs in iOS mode.

## Requirements

Docker, Google Chrome, Node. Nothing talks to a real external service.

## Usage

```sh
cd flightbook-mobile-app/e2e
npm install

# Compare the working tree against main (or any ref): builds both, records
# baselines from the base, runs the suite against the working tree.
./compare.sh            # or: ./compare.sh <ref>
npm run report          # HTML report with expected / actual / diff images
```

Or step by step:

```sh
npm run stack:up        # Postgres in Docker + API on :8282 + seed data
(cd .. && npx ng build) # the suite serves ../www/browser
npm run baseline        # record screenshots from the current build
npm test                # compare against them
npm run stack:down
```

`E2E_WWW=<dir>` serves a different build (e.g. one made from another branch).

## How it works

- **Database:** `postgis/postgis:15-3.4`, the image flightbook-api's own e2e
  tests use; the API runs its migrations on startup.
- **Login:** the API's auth guard falls back to legacy JWTs signed with
  `JWT_SECRET`. `stack/seed.mjs` mints one for the seeded user and the tests
  put it in `localStorage.access_token`, so Keycloak is never needed. The real
  login screen is only screenshotted, not exercised.
- **Seed data** lives in `tests/seed-data.js`, shared by the seeder and the
  assertions. Places, gliders and flights go through the API; the school side
  (school, instructor, student + control sheet, appointments with a
  subscription, tandem pilot + passenger confirmations, emergency contact) has
  no student-facing create endpoints, so `stack/seed.mjs` inserts it as SQL.
  Appointments are relative to the database's "today".
- **Stability:** fixed clock (2026-10-22), `en` locale, Europe/Zurich, Ionic
  animations off, one worker.
- **Baselines** (`__screenshots__/`) are not committed: they depend on the
  machine's Chrome and fonts, and `compare.sh` regenerates them from the base
  ref every time.

## Known

- The control sheet logs `Cannot read properties of null (reading
  'altitudeFlight')` for a user *without* a control sheet — a pre-existing app
  bug. The seeded user has one, so the suite doesn't hit it.
- Not covered: native Capacitor plugins, the instructor-side views.
