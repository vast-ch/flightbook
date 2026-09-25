# CLAUDE.md — flightbook-mobile-app

Angular 19 (standalone components, signals) + Ionic 8 + Capacitor. A paragliding
logbook. This file records what is specific to *this* app and what has actually
caught people out; the global `~/.claude/CLAUDE.md` still applies for everything
else.

**Note:** the global file's stack section (TanStack, shadcn/ui, Tailwind, Drizzle,
Vitest) describes a different kind of project. It does not apply here. Follow this
file and the surrounding code.

---

## Git workflow

- **Commit after every bigger change, as you finish it** — in practice roughly one
  commit per prompt: when the thing asked for is done and verified, commit it
  before moving on. Don't let several changes pile up in one working tree, and
  don't batch them into an omnibus commit at the end. Splitting an interleaved
  tree afterwards is far harder than committing as you go.
- If one prompt genuinely contains two unrelated changes, commit them separately
  rather than stretching the rule to one commit.
- **Check whether the branch's PR is still open before pushing.** The PRs on this
  branch merge quickly, and pushes to a branch whose PR has already merged go
  nowhere visible — the work sits on the branch looking pushed while no PR
  carries it. This has happened twice.

## Scope

- `flightbook-api/` is **read-only**. Read it to understand the contract, run its
  tests, never edit its source, DTOs, entities or migrations. If the work seems
  to need an API change, say so and stop.
- The same goes for `flightbook-website/` (which has its own `AGENTS.md`).

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
- `tsconfig.app.json` sets `"strict": false`. There are ~299 pre-existing strict
  errors; don't add more. `Number.isFinite()` does **not** narrow
  `number | undefined`.
- **`ng test` is broken repo-wide** and predates the redesign: `zone.js` 0.15 no
  longer exports `dist/zone-testing`, and ~20 legacy specs still import
  `IonicModule`, removed by the standalone migration. Specs here are effectively
  documentation until that is repaired — do not claim a spec passes.
- For anything visual, measuring beats eyeballing. Chrome is available; rendering
  the real built stylesheet and reading geometry out of `getBoundingClientRect()`
  has repeatedly contradicted a plausible-sounding guess. Note that a `padding`
  inset moves the *text*, not the element box — measure a `Range` over the text
  node.
- List "eyebrow" totals on the place and glider lists count only the rows paged in
  so far. An honest number needs a count endpoint, i.e. an API change.
