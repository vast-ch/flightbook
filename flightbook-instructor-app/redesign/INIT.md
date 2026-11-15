# Instructor app redesign — context primer

Read this before working on the instructor app's student page or theme. It records what was
changed, the decisions behind it, and the facts that were expensive to establish, so a future
session does not have to re-derive them.

Source of truth for the design: Claude Design project `88a72d79-66fc-49a5-98e8-59b6b7dc973a`
("Flightbook design consistency"), canvas `Instructor App.dc.html`.

---

## 1. What changed

Two things landed together, because the second depends on the first.

**A. Angular Material theme migrated M2 → M3 (app-wide).**
`src/styles.scss` moved from `mat.m2-define-palette` / `mat.m2-define-light-theme` /
`mat.all-component-themes` to `mat.theme()`, emitting `--mat-sys-*` system variables.
Every screen inherits the new palette and font; only the student page and the shell were
restyled. Other screens were verified as functional, not redesigned.

**B. The student page rebuilt to the mockup.**
Six stacked `mat-expansion-panel`s became a responsive card grid; the list pane, flights table,
control sheet, notes and emergency contact were all rebuilt; the app shell got a white toolbar
with logo and account controls.

### File map

| Path | Role |
|---|---|
| `src/styles.scss` | M3 theme via `mat.theme()`, global dialog overrides |
| `src/styles/_theme-colors.scss` | Generated M3 tonal palettes for `#0b76c2` |
| `src/styles/_tokens.scss` | The `--fb-*` layer |
| `src/styles/_m2-compat.scss` | Keeps `color="primary"`/`"warn"` working under M3 (see §4) |
| `src/styles/_student-page.scss` | **All** structural CSS for the page, nested under `.fb-student-page` |
| `src/app/main/main.component.*` | Shell / toolbar |
| `src/app/main/pages/students/students.component.*` | List pane |
| `src/app/main/component/student-detail/*` | Detail pane, flights table |
| `src/app/main/component/{control-sheet,level,start-rating,student-note}/*` | Detail cards |
| `src/app/main/component/email-dialog/*` | Shared dialog, restyled |
| `src/assets/i18n/{de,fr}.json` | ~25 new keys, key sets identical |

Component `.scss` files in this feature are **empty pointer files** — all structural CSS lives in
`_student-page.scss`. That is deliberate (see §3).

---

## 2. Design tokens

Font **Sora**; icons **Material Symbols Outlined** (switched globally via `MAT_ICON_DEFAULT_OPTIONS`;
Material Icons kept loaded as a per-instance fallback).

Primary `#0b76c2` (hover `#0a5e9b`, active `#095c99`) · accent `#45b1fd` · ink `#10293c` ·
text `#37556b` / `#5b7284` / `#6c8394` · borders `#dce8f1` / `#e7f0f7` / `#cfe0ec` ·
page `#f2f7fb` · surface `#ffffff` · subtle fill `#f7fbfe` ·
danger `#b8392b` / `#8e241a` on `#fdeeec`, border `#f3c7c1`, active `#a13124` ·
success `#186340` / `#2f7a4f` on `#f1f9f4`, border `#bfe0cc` · pending `#fffaf3`.

Radii 12px cards · 9px controls · 8px small buttons · 7px tiny · 99px pills.
Type scale is dense: 10px uppercase table headers · 11–11.5px meta · 12–12.5px body ·
13–13.5px card titles · 14px list names · 17–22px headings. Weight 600 dominates.

**Token rule:** if a value has an M3 system role, `--fb-*` is a `var()` alias of `--mat-sys-*`,
never a literal. Literals only for values M3 has no role for.

---

## 3. Styling policy (three tiers)

1. **Token-first** — anything reachable by a design token uses `mat.<component>-overrides(())`
   in a scoped selector. Override keys **drop the component prefix**:
   `mat.table-overrides((header-headline-size: …))`, not `table-header-headline-size`.
   A misspelled key is **silently ignored** and ships a broken theme with no error — always
   verify names against `node_modules/@angular/material/**/_m3-*.scss`.
2. **Scoped structural CSS** for what has no token, in `_student-page.scss`, every selector nested
   under `.fb-student-page`. This replaces `::ng-deep`, is leak-proof, and is charged to the
   generous `initial` budget rather than the per-component one.
3. **`::ng-deep` is banned in new code.** The three that existed here were deleted, not ported.
   (Others remain in out-of-scope files: enrollment, school-register, appointments, tandem-pilots.)

Do not write a global `.card` rule — `tandem-pilot-detail.component.html` uses `class='card'` and is
out of scope.

**Dialogs are the documented exception.** They render into a CDK overlay appended to `<body>`,
outside `.fb-student-page`, so page-scoped rules can never reach them. Style them from the
component's own `.scss` (works because component styles follow their template wherever it mounts)
or from a global rule keyed on a `panelClass`.

---

## 4. Verified facts — do not re-derive

- **M3 does not emit `.mat-primary` / `.mat-accent` / `.mat-warn`.** Guard at
  `@angular/material/button/_button-theme.scss:33` (`get-theme-version($theme) != 1`), repeated
  across ~20 component theme partials. `_m2-compat.scss` exists solely for this.
  `mat.color-variants-backwards-compatibility()` covers most components but **deliberately skips
  raised/flat/outlined/text buttons and the toolbar** — those are hand-written.
- **`theme-type` defaults to `color-scheme`**, which emits `light-dark()` per role
  (`core/tokens/_system.scss:64`). It is pinned to `light`; unpinning it makes the app invert on a
  dark-OS machine.
- **`indigo-pink.css` must stay out of `angular.json`.** Its first rule is
  `html{--mat-sys-on-surface: initial}`, which severs the `var(--mat-comp-token, var(--mat-sys-*))`
  fallback chain for every component.
- **M3 makes every button a pill** (`corner-full`); the 9px override in `_m2-compat.scss` undoes it.
- **`anyComponentStyle` budget** was raised to 8kb/16kb in `angular.json`.
- **Type-check with `npx tsc --noEmit -p tsconfig.app.json`.** Bare `npx tsc --noEmit` uses the root
  `tsconfig.json`, which has no `include`, globs the six broken stub specs, and always fails.
- **`npm test` cannot run.** `@angular-devkit/build-angular` is absent while `karma.conf.js`
  requires it, and jasmine ~3.10 sits against Angular 21. All six specs are CLI stubs. Verification
  is `tsc` + `npm run build` + manual exercise.
- **`CdkTable` caches its row set.** `when` predicates are re-evaluated only inside `renderRows()`,
  which the differ invokes on **data-source** changes. Component-field state driving a `when` row
  requires an explicit `renderRows()` call. `multiTemplateDataRows` must also be `true` for a
  detail row to render *in addition to* its data row rather than replacing it. This broke flight
  rejection completely for six rounds while the build stayed green.
- **`mat-form-field` hosts are not `border-box`.** Material sets `box-sizing` only on descendants,
  and this app has no global reset — so `width:100%` plus padding on the host overflows its
  container. Put padding on a wrapper.
- **A `<td>` with `display:flex` leaves the table formatting context** — it stops stretching to row
  height and loses `vertical-align: middle`, misaligning against sibling cells. Put the flex on an
  inner wrapper.
- **An absolutely-positioned flex item resolves its static position against the container's
  `justify-content`**, not its DOM order — which anchored a CDK datepicker overlay to the wrong
  edge. Wrap the hidden input in a `position:relative` element at the trigger.
- **Statistics are all-time only.** `GET /instructor/schools/:id/students` returns one aggregate per
  student (`student.facade.ts:45` → `flight.repository.ts:143`, no `GROUP BY year`). The
  year-grouping endpoints (`/flights/statistic`, `/v2/flights/statistic?type=yearly`) are bound to
  `req.user`, so an instructor's JWT cannot use them for a student — **a per-year Period filter needs
  an API change.**

---

## 5. Accepted deviations from the mockup

These are deliberate. Do not "fix" them.

| Deviation | Why |
|---|---|
| Period bar shows one inert **Total** segment | No API for per-year stats; deriving them client-side was rejected on backend-load grounds |
| Sort field keeps Material's floating label, 44px | Mockup pins its caption inside a native `<select>`; user chose Material's idiom |
| `emergency` icon removed from the emergency card | User's explicit request; the mockup has it |
| No inset accent bar on pending flight rows | The mockup contains no `box-shadow` anywhere |
| `#6c8394` only at ≥18px or as decoration | It is ≈4.0:1 on white — below AA. Small text uses `#5b7284`. **The mockup uses `#6c8394` at 11px, so this gets reintroduced by anyone matching it literally — it has been swept out twice** |
| Control-sheet checklist stays alphabetical | `\| keyvalue` default sort; SHV declaration order is a content change |
| Validate/reject buttons always visible | Mockup gates them behind `f.showActions`; hiding them would remove re-validate capability |
| Kontrollblatt + Prüfungen share one card | Matches the mockup — its outer card div spans both |
| Tandem / passenger confirmations | Out of scope |

---

## 6. Known issues and follow-ups

- **`src/assets/icon/` is git-ignored.** The user's global gitignore has the macOS `Icon` rule, and
  with `core.ignorecase=true` it matches the lowercase `icon/` **directory**. Neither `favicon.png`
  nor the new `logo.png` is tracked. **`logo.png` must be force-added
  (`git add -f …/src/assets/icon/logo.png`)** or the toolbar ships a broken image.
- `_m2-compat.scss` can be deleted once no template uses `color=` — currently **47 `color="primary"`
  + 9 `color="warn"` across 26 files**, 0 `accent`. Its header comment says "30 + 6", which is
  understated (that figure counted buttons only). **Move the 9px button-shape block out first — that
  is design, not compat.**
- `isExamReady()` is duplicated in `students.component.ts` and `student-detail.component.ts`.
- No `:id` route param — the student page cannot be deep-linked; selection is component state.
- `student-detail` mutates its `@Input() student` in place, and `students.component` depends on that
  shared identity. **Do not add `OnPush` anywhere.**
- Archived students' control sheets remain editable.
- Other screens inherited the theme but were not restyled.
- `<html lang="en">` while the UI ships de/fr only.
- Pre-existing de/fr key mismatches (`appointmentType.tite` typo, `password.*`) — not from this work.

---

## 7. Repo conventions this work follows

Default change detection (zero `OnPush` in the app) · constructor injection, not `inject()` ·
RxJS with `takeUntil(this.unsubscribe$)` + `ngOnDestroy`, no `async` pipe anywhere ·
`UntypedFormBuilder` · new control flow `@if` / `@for (…; track …)` · the shared snackbar options
object · dialogs opened `{ data, width }` and closed `{ event: … }` ·
single breakpoint **768px**, matching `DeviceSizeService.isMobile`; no `BreakpointObserver`.

---

## 8. How this was built — the agent process

Work ran as a coordinator plus disposable sub-agents, in rounds driven by the user testing the
running app. All agents on Sonnet.

**Roles per round**

1. **Implementer** — one agent, never parallelised, given a brief containing the diagnosed root
   cause and the mockup's literal values rather than a description of the symptom.
2. **Design-fidelity reviewer** — read-only, compares implementation against the mockup source.
   Spacing, colour, typography, sizing only.
3. **Code-quality reviewer** — read-only, runs **in parallel** with #2. Angular/Material practice,
   repo conventions, change detection, accessibility, scope discipline. No visual comments.

Then the coordinator merges both reports into required vs nice-to-have, drops anything contradicting
a settled decision, and sends the required items back. Capped at 3 rounds per cycle.

**What made it work**

- **A binding contract file** given to all three roles, listing scope, verified constraints, derived
  states, and settled decisions. Without it, reviewers re-litigate closed questions every round.
- **Splitting the two reviewers** and forbidding each from commenting on the other's domain. They
  disagreed usefully — on one occasion the code-quality pass judged a colour token permissible while
  the fidelity pass found the element it coloured shouldn't exist at all.
- **The coordinator verifying every claim** rather than trusting reports. Several agent claims were
  wrong or overstated, including a "no new HTTP request" that had in fact added one.
- **Telling reviewers what NOT to file.** The mockup defines only hover states and no media queries;
  without being told, reviewers file their absence as defects every round.

**What went wrong, and the lesson**

- **Source review cannot replace running the app.** The user found real defects after every round
  that both reviewers missed — a blue header, misaligned buttons, an oversized dropdown, and a
  completely non-functional reject flow that had been dead since round 1 while the build stayed
  green.
- **An agent ran `git checkout` on two files** and destroyed uncommitted work from a prior round.
  Every brief afterwards forbade `git checkout` / `restore` / `stash` explicitly.
- **Briefs propagate the coordinator's own errors.** Several defects traced to instructions rather
  than implementation: a `variant="bar"` that misread the mockup, an inset accent bar that exists
  nowhere in the design, a dialog `maxWidth` based on a wrong premise, and the `when`-predicate
  pattern specified without accounting for what drives it.
- **Anything not rendered is unverified by construction.** The reject box accumulated seven rounds
  of unexamined CSS drift because it never appeared on screen.
