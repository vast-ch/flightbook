# CLAUDE.md — flightbook-mobile-app

Angular 22 (standalone components, signals, zoneless, OnPush) + Ionic 9 + Capacitor. A paragliding
logbook. This file records what is specific to *this* app and what has actually
caught people out; the global `~/.claude/CLAUDE.md` still applies for everything
else.

**Note:** the global file's stack section (TanStack, shadcn/ui, Tailwind, Drizzle,
Vitest) describes a different kind of project. It does not apply here. Follow this
file and the surrounding code.

---

## Git workflow

- never do a commit. Only if the user ask you to do it.

## Scope


## Styling

- **Design tokens live in `src/theme/tokens.scss`** as `--fb-*` custom properties,
  with shared primitives: `.fb-card`, `.fb-card--flush`, `.fb-row`, `.fb-chip`,
  `.fb-stat`, `.fb-status`, `.list-header`, `.form-header`, `.fb-section-label`.
  Reuse these before writing anything new.
- `src/theme/variables.scss` loads **after** `tokens.scss`. A rule there wins ties
  on source order — `ion-modal.dateModal { --background: transparent }` at (0,1,1)
  beat a new `.filterDateModal` at (0,1,0) and the new rule silently did nothing.
  **When overriding something from `variables.scss`, check the specificity, then
  verify the winning selector in `www/browser/styles.css` after a build.**
- **Ionic renders modals at the app root**, outside component style scope. A modal
  shell styled from a component's `.scss` builds as
  `ion-modal.foo[_ngcontent-%COMP%]` and can never match. Modal `cssClass` styles
  belong in `tokens.scss` — see `.fb-filter-sheet`, `.fb-add-sheet`,
  `.skill-sheet-modal`, `.filterDateModal`.
- **Ionic components paint their own backgrounds**, and this theme remaps
  `--ion-color-light` to `#f2f7fb` — the same value as `--fb-bg`. `ion-datetime`
  defaults to `--ion-color-light`, so a picker over a filter sheet rendered itself
  in the background colour. Check a component's own `--background` before styling
  the shell around it.
- `@if` / `@for` leave **comment anchor nodes** behind, so `:last-child` and
  `:first-child` are unreliable for separators. Use adjacency: `& + &`.
- Ionic's reset sets `body { word-wrap: break-word }`, which permits mid-word
  breaks. A required-field marker is a zero-width `.fb-row__req` span for that
  reason — see the comment on `.fb-row__label`.

## Change detection (zoneless + OnPush)

- No Zone.js (`provideZonelessChangeDetection()` in `app.config.ts`), and every
  component is `ChangeDetectionStrategy.OnPush`. New components too.
- A template only updates when Angular is told: a signal it reads changed, a
  template event fired, an `@Input` got a new reference, or `markForCheck()`.
  A plain field written after `await`, in a `subscribe`, an Ionic alert/action
  sheet `handler`, `modal.onWillDismiss()`, a Worker or a third-party listener
  silently never renders. Prefer a signal; use `markForCheck()` for
  `ngModel`-bound model objects.
- `markForCheck()` reaches the component and its **ancestors**, not children.
  A parent that mutates an object an OnPush child takes as `@Input` must hand
  over a new reference - see `republishFlight()` in flight-add/flight-edit.
- `NgZone.run()` is a no-op now; it does not render anything.
- A `ControlValueAccessor` must `markForCheck()` in `writeValue` /
  `setDisabledState` (forms call them from a microtask) - see `phone-number`.
- Guard: `e2e/` `npm run test:cd` runs a dev build with exhaustive
  `checkNoChanges`; any unnotified binding fails as NG0100.

## Bootstrap and routing (standalone, no NgModules)

- `main.ts` → `bootstrapApplication(AppComponent, appConfig)`. App-wide
  providers live in `app/app.config.ts`, routes in `app/app.routes.ts`; every
  page is lazy via `loadComponent`. Don't add NgModules or `*.module.ts` files.
- A provider a page needs goes in its `@Component({ providers })` or in
  `app.config.ts`, not in a route module (see `NxgTransalteSortPipe` on
  control-sheet).
- ngx-translate 18: set up once in `app.config.ts` with
  `provideTranslateService` + `provideTranslateHttpLoader`. There is no
  `TranslateModule` any more - components import the standalone
  `TranslatePipe`. `translate.currentLang` is a signal (`getCurrentLang()` for a
  snapshot); the old default language is the "fallback" language
  (`setFallbackLang`).

## State

- Signals are the idiom; stores live in `shared/*.store.ts`.
- `toObservable()` needs an injection context — a **field initializer**, not
  `ngOnInit` (NG0203).
- `FlightStore` has two counters: `revision` (bumped by filter changes too) and
  `dataRevision` (only when the data itself moved). A consumer fetching with
  `applyFilter: false` must watch `dataRevision`, or a filter keystroke costs a
  round-trip that cannot change the answer.
- A filter that summary chips derive from must be a **signal**, not a plain
  object: dropping one criterion while others remain leaves `filtered` true, so
  nothing recomputes and the chips go stale.
- Never fetch by temporarily assigning a shared filter and restoring it in the
  response handler — it never restores on error. Add an explicit per-request
  option instead (`GliderStore.getGliders` has `archived` and `applyFilter`).

## i18n

- Four locales in `src/assets/i18n/`: `en`, `de`, `fr`, `it`. **Key parity is
  required** — a key added to one must exist in all four. Verify by flattening
  and comparing key sets, not by eye.
- Write the DE/FR/IT strings and move on; the maintainer proofreads them.
- **Edit these files textually, not by re-serialising the JSON.** `json.dumps`
  normalises `"content":"…"` to `"content": "…"` and rewrites twenty enormous
  control-sheet strings for a single space.
- Plurals are hand-rolled: a `…One` sibling key plus an `@if` (see
  `placelist.summaryOne`). Only 3 of ~14 `{{count}}` strings have one — the rest
  will read "1 flights" until someone adds a pipe or ngx-translate plurals.
- Angular's `DatePipe` **cannot take an IANA timezone**. `timezoneToOffset` does
  `Date.parse('Jan 01, 1970 00:00:00 Europe/Zurich')` → `NaN` and silently falls
  back to the device offset.

## Dates and timezones

School appointments arrive as UTC and are rewritten into the school's **wall
clock** parked in a device-local `Date`, with the true instants stamped alongside
as `scheduledAt` / `deadlineAt` (epoch ms). Anything comparing against "now" must
use those, never the rewritten fields — `.tz()` changes how an instant prints,
not which instant it is.

## Environments

`src/environments/environment.ts` is the **development** environment and has no
`fileReplacements` entry of its own, so a bare `ng build` — no
`--configuration` — bakes it into the bundle. Keep it on `localhost`; a shared
host committed here changes which API every other checkout talks to. `production`
and `docker` are replaced at build time.

## Verifying

- `npx tsc --noEmit -p tsconfig.app.json` and `npx ng build`. The sandbox aborts
  `ng build` with SIGABRT — run it unsandboxed.
- `"strict": false` is pinned in `tsconfig.json` (TypeScript 6 defaults it to
  true). There are ~299 pre-existing strict errors; don't add more.
  `strictTemplates: false` is pinned too (Angular 22 defaults it to true).
- No `baseUrl` (deprecated in TS 6): `'src/...'` imports resolve through
  `paths` in `tsconfig.json`.
- Template `?.` returns `undefined` since Angular 22 (was `null`). Don't add
  `$safeNavigationMigration(...)`; write templates that don't care which.
- `HttpClient` stays on XHR (`withXhr()` in `app.config.ts`); Angular 22's
  default is `fetch`. `Number.isFinite()` does **not** narrow
  `number | undefined`.
- **Unit tests:** `npx ng test --watch=false --browsers=ChromeHeadless` (run
  unsandboxed). Only pure-logic specs live here (`shared/util/format.spec.ts`,
  `place-map/place-marker.style.spec.ts`); the generated "should create" smoke
  specs were deleted because they tested nothing the e2e suite doesn't. Add unit
  specs for logic (formatting, parsing, store calculations), not for rendering.
- **Change detection:** `cd e2e && npm run test:cd` - see the section above.
  Run it for anything touching component state.
- **e2e:** `e2e/` runs Playwright against the built app and a local API
  (Postgres in Docker, seeded user, no Keycloak). `e2e/compare.sh [ref]`
  screenshots every screen on a base ref and diffs the working tree against it,
  plus form flows checked through the API — run it for dependency upgrades and
  styling changes. See `e2e/README.md`.
- For anything visual, measuring beats eyeballing. Chrome is available; rendering
  the real built stylesheet and reading geometry out of `getBoundingClientRect()`
  has repeatedly contradicted a plausible-sounding guess. Note that a `padding`
  inset moves the *text*, not the element box — measure a `Range` over the text
  node.
- List "eyebrow" totals on the place and glider lists count only the rows paged in
  so far. An honest number needs a count endpoint, i.e. an API change.
