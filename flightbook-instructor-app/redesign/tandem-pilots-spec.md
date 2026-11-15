# Tandem pilots page redesign: binding spec

Contract for the implementer and both reviewers. `INIT.md` still applies; where this file is more
specific, this file wins. Paths are under `flightbook-instructor-app/` unless prefixed `api:`
(= `flightbook-api/src/`). `M:n` = line n of the mockup `Instructor App.dc.html`.

> **Superseded (2026-11-03):** the Period control is removed (user decision, see `INIT.md` §5). Every
> Period item below (§3.0 period state, the `fb-period-bar` markup and styles, acceptance 17-19, D16)
> no longer applies. `createTandemPagingParams` stays, without `from`/`to`, because it still keeps the
> shared Appointments filter out of the tandem tables.

Forbidden for everyone: `git checkout/restore/stash/reset`.

---

## 1. Scope and settled decisions

**In scope**
- List: `src/app/main/pages/tandem-pilots/*`
- Detail: `src/app/main/component/tandem-pilot-detail/*` (flights and passenger confirmation tables)
- `export-dialog/*`, `payment-form-dialog/*`
- New `src/styles/_tandem-page.scss`, added with `@use './styles/tandem-page';` in `src/styles.scss`
- i18n in `src/assets/i18n/{de,fr}.json`
- `src/app/core/services/school.service.ts`: only the change in §3.0 (see Open question 1)

**Out of scope**: `email-dialog` component files (already restyled), `tandem-config`,
`custom-field-dialog`, enrollment, any API change, refactoring finished pages (Students, Appointments).

**Fix while rebuilding**
- Unclosed payment `<td>` (`tandem-pilot-detail.component.html:67-76`)
- Global `::ng-deep` badge block (`tandem-pilots.component.scss:37-58`), unused `MatBadgeModule`,
  stale `.mat-table` selector
- Bare clickable `mat-icon`s (`tandem-pilot-detail.component.html:10,12`) become real labelled buttons

**Report only, do not fix**, unless the mockup directly requires it: see §7.2.

**Settled**
- Layout: master-detail like Students; the mockup overrides where it differs.
- Archived pilots stay reachable through Active/Archived tabs (deviation D1).
- Structural CSS under `.fb-tandem-page` in the partial. Component `.scss` for the page and detail
  become pointer comments. Dialogs are styled from their own `.scss`. `::ng-deep` and global `.card`
  are banned.
- The needed `fb-*` vocabulary is copied into the partial, as Appointments did. No shared partial.
- Tandem components stay `standalone: true`, default change detection, no `OnPush`. Otherwise INIT §7:
  constructor injection, `takeUntil(this.unsubscribe$)`, no `async` pipe, `@if`/`@for`.
- 768px is the only breakpoint. `#6c8394` only at 18px or larger, or as decoration. Small text uses
  `#5b7284` (`--fb-text-3`).
- Native `confirm()` stays for archive; the mockup shows no archive dialog.

---

## 2. Data feasibility

`GET /schools/:id/tandem-pilots` returns only `id`, `user`, `isArchived`
(api:`training/tandem-pilot/interface/tandem-pilot-dto.ts`). There is no statistic, no last flight,
no pending count. Per-pilot aggregates do not exist.

Legend: **A** available, **D** derivable with no new request, **N** needs a new request,
**U** unavailable without an API change.

| Mockup element | Source | Status | Rendered |
|---|---|---|---|
| List row: initials, name | `TandemPilot.user`, `src/app/shared/domain/tandem-pilot.ts` | A | As mockup M:128-129 |
| List row: `group` type icon | Static; M:1359 (`tandem:true`) | A | As mockup |
| List row: flights, last flight, glider | Mockup hides them on tandem: `showTraining` false, M:138, M:1370 | n/a | Nothing, matching mockup |
| List row: `{n} to check` pill | M:130. Tandem DTO has no count; flights query has no payment-state param (api:`flight/flight.repository.ts:397-437`) | U | Omitted (D3). Deriving needs N+1 requests |
| Sort: first name, last name | Client-side on `user` | D | Two options |
| Sort: flights fewest/most, awaiting validation | No per-pilot data | U | Omitted (D4) |
| Period Total/current/previous year | **Differs from Students.** Both tandem endpoints honour `from`+`to`: flights api:`flight/flight.repository.ts:412-418`, pager uses the same builder at `:372`; confirmations api:`tandem/passenger-confirmation/passenger-confirmation.repository.ts` (`Between`) | A, with §3.0 | **Real, working control.** Tables and both counts filter |
| Stat: Flights | `flightsPagerEntity.totalItems` from the paged flights call (`tandem-pilot-detail.component.ts:106-111`); pager api:`flight/flight.repository.ts:363-381` | D | Tile, period-filtered |
| Stat: Passengers | `passengerConfirmationsPagerEntity.totalItems` (`tandem-pilot-detail.component.ts:119-126`); api:`passenger-confirmation.facade.ts:41` | D | Tile, period-filtered. Counts signed confirmations |
| Stat: Airtime, Average | `/flights/statistic` is bound to `req.user` (INIT §4). `getAllTandemPilotFlights` is capped at 100 rows when no limit is sent (api:`flight/flight.facade.ts:60-62`), so a sum over it is wrong for busy pilots. A sum over one page is wrong always | U (only a full-fetch workaround) | Omitted (D2). Open question 3 |
| Stat: Confirmed, Open confirmations | `PassengerConfirmation` has no flight FK (api:`passenger-confirmation.entity.ts`). `validated` is forced true: api:`tandem/tandem.controller.ts:22` and the mobile form cannot submit without it (`passenger-confirmation-form.component.ts:119`). A row exists only once signed, so "confirmed" = all rows and "open" has no data behind it | U | Omitted (D2). Open question 2 |
| Passengers table: all six columns | `PassengerConfirmation`, already in `displayedPassengerColumns` | A | As mockup |
| Flights: Nr, glider, km | `Flight.number`, `glider`, `km`; returned, today not displayed (api:`flight/flight.repository.ts:27-30`) | D | New columns |
| Flights: date, take-off, landing, time, description | Already displayed | A | As mockup |
| Flights: Instructor | `appointmentInstructor` is not joined by the tandem query. `tandemSchoolData.instructor` is (`flight.repository.ts:35`, api:`flight/interface/tandem-school-data-dto.ts`) | D | `F. Lastname` of the person who recorded the payment, else `-`. Open question 4 |
| Flights: Solo toggle | `shvAlone` is returned, but no tandem write endpoint exists (`school.controller.ts` tandem block), and a tandem flight is never solo | n/a | Omitted (D5) |
| Flights: Validation pill | Maps to `tandemSchoolData.paymentState`. Null/empty = pending | A | Payment state pill |
| Flights: validate/reject actions | Map to the payment actions; PUT per flight | A | Open `payment-form-dialog` (D6) |
| Flights: Validate all | No bulk tandem endpoint; `validateAllFlight` is for student validation | U | Omitted (D7) |
| Payment amount, custom fields | Not in mockup; real data | A | Kept (D8) |
| Header print | Not applicable; existing action there is export | n/a | `download` button in that slot (D9) |
| `licence` | Computed M:1407, never rendered in the template | n/a | Nothing |

---

## 3. Structure

### 3.0 Period and the shared filter leak (read first)

`createFilterParams` (`school.service.ts:186`) reads the **shared mutable** `SchoolService.filter`.
`AppointmentsComponent` sets `filter.from = today` on init (`appointments.component.ts:110,290-302`)
and never clears it, and `SchoolService` is a root singleton. So today, after visiting Appointments:
- paged tandem flights are silently limited to `date >= today`;
- paged confirmations get `from` without `to`, which hits
  `options.where.scheduling` on an entity with no such property
  (`passenger-confirmation.repository.ts`). TypeORM 0.3 is expected to throw, giving a failed request.
  Inferred from source, not run.

The Period control cannot work on top of this, so:

1. In `school.service.ts`, change `getPassengerConfirmationsBySchoolIdAndTandemPilotId` and
   `getTandemPilotFlightsBySchoolIdAndTandemPilotId` to accept
   `{ limit?, offset?, from?: string, to?: string }` and build params in a new private
   `createTandemPagingParams(...)` that ignores `this.filter`. Add the same "deliberately independent"
   comment style as `getAppointmentCount` (`:92`). Their only caller is the detail component.
2. `from` and `to` are always sent together or not at all, because the confirmations endpoint only
   works with both.
3. `createFilterParams` itself is unchanged.

Period state lives in `TandemPilotDetailComponent`:

```ts
readonly currentYear = new Date().getFullYear();
periods: (number | 'total')[] = ['total', this.currentYear, this.currentYear - 1];  // M:1390
period: number | 'total' = this.currentYear;                                         // M:1121
```

Selecting a pilot keeps the period (M:1365 does not reset it). Selecting a period resets both tables
to page 1 and reloads both. Range = `${y}-01-01` to `${y}-12-31`; Total sends neither.

### 3.1 Page and list pane

```html
<mat-sidenav-container class="fb-tandem-page" autosize>
  <mat-sidenav #sidenav mode="side" opened class="fb-list-pane">
    <div class="fb-list-pane__add">
      <button mat-raised-button color="primary" class="fb-add-tandem-button">
        <mat-icon>group_add</mat-icon> {{ tandemPilot.addTandemPilot }}
      </button>
      <button mat-icon-button class="fb-export-all-button" aria-label+matTooltip=export.exportAllPilotsData>
        <mat-icon>download</mat-icon>
      </button>
    </div>
    <div class="fb-tab-selector" role="tablist">...</div>    <!-- copy of Students, no counts -->
    <div class="fb-list-pane__sort"><mat-form-field class="fb-sort-field">...</mat-form-field></div>
    <div class="fb-tandem-list" role="tabpanel" id="fb-tandem-list-panel">
      @for (pilot of displayedTandemPilots; track pilot.id) {
        <button type="button" class="fb-tandem-row" [class.fb-tandem-row--selected]="...">
          <div class="fb-tandem-row__main">
            <span class="fb-avatar">{{ initials(pilot) }}</span>
            <span class="fb-tandem-row__name">...</span>
            <mat-icon class="fb-tandem-row__type" aria-hidden="true">group</mat-icon>
          </div>
        </button>
      } @empty { <p class="fb-empty-list">{{ tandemPilot.noTandemPilots }}</p> }
    </div>
  </mat-sidenav>
  <mat-sidenav-content><fb-tandem-pilot-detail .../></mat-sidenav-content>
</mat-sidenav-container>
```

| Element | Values (mockup source) |
|---|---|
| `.fb-list-pane` | 320px as Students, 100% at ≤768px, white, right border `--fb-border-subtle` (D11) |
| `.fb-list-pane__add` | Padding `16px 18px 12px` (M:95); `display:flex; gap:var(--fb-space-3)` |
| Add button | `flex:1; height:44px`, radius 10px (M:96), via `mat.button-overrides((protected-container-shape:10px))`, 13.5px/600, icon 18px |
| Export-all button | 44×44, border `--fb-border-subtle`, radius `--fb-radius-md`, white, icon 18px `--fb-text-2` |
| `.fb-tab-selector` / `.fb-tab` | Copy from `_student-page.scss:54-91`; gap 22px, padding `12px 0 11px`. Drop `.fb-tab-count` |
| `.fb-list-pane__sort`, `.fb-sort-field` | Copy from `_student-page.scss:100-142` |
| `.fb-tandem-row` | `display:block; width:100%; padding:14px 18px 14px 15px; border:0; border-bottom:1px solid var(--fb-surface-variant); border-left:3px solid transparent; background:transparent` (M:1361-1362) |
| `--selected` | `border-left-color:#45b1fd` via `--fb-tertiary`; `background:var(--fb-nav-active-bg)` (#e9f6ff). Mockup literal, differs from the Students row on purpose |
| `__main` | flex, center, gap 10px (M:127) |
| `.fb-avatar` | 28×28, 50%, `--fb-bg`, 10px/600, `--fb-text-3` (M:128) |
| `__name` | flex 1, 14px/600, -0.01em, `--fb-ink`, ellipsis (M:129) |
| `__type` | 17px, `--fb-text-4`, decorative (M:133) |

Component TS changes:
- Add `selectedTabIndex = 0`, `sortBy = 'firstname'`, `displayedTandemPilots`, `initials()`,
  `onTabKeydown()`, `selectSort()` (first/last name, `localeCompare`), and the
  `effect(() => { if (!isMobile()) sidenav?.open(); })` from `students.component.ts:47-51`.
- The sort applies to whichever list is displayed, and is re-applied after every sync.
- `selectSort()` replaces the old comparator (`tandem-pilots.component.ts:93,96`). The mockup's Sort
  control requires this fix.
- Replace `tabGroup?.selectedIndex` (`:76`) with `selectedTabIndex`.
- Remove `MatListModule`, `MatTabsModule`, `MatBadgeModule`. Add `MatFormFieldModule`, `MatSelectModule`.
- Add `panelClass: 'fb-email-dialog-panel'` to the `EmailDialogComponent` open call, as
  `students.component.ts:170`. The tandem call site is in scope; the email-dialog files are not.

### 3.2 Detail

```html
@if (tandemPilot) {
<div class="fb-detail-pane">
  <header class="fb-detail-header">
    @if (isMobile()) { back button .fb-detail-header__back, aria student.backToList }
    <div class="fb-detail-header__title">
      <div class="fb-detail-header__eyebrow"><span class="fb-detail-header__role">{{ tandemPilot.roleLabel }}</span></div>
      <h1>{{ firstname }} {{ lastname }}</h1>
    </div>
    <button mat-icon-button class="fb-detail-header__action" aria+matTooltip=export.exportPilotData><mat-icon>download</mat-icon></button>
    @if (!tandemPilot.isArchived) {
      <button mat-icon-button color="warn" class="fb-detail-header__action fb-detail-header__action--danger"
        aria+matTooltip=tandemPilot.archiveTandemPilot><mat-icon>archive</mat-icon></button>
    }
  </header>
  <div class="fb-period-bar">
    <span class="fb-period-bar__label" id="fb-tandem-period-label">{{ student.period.label }}</span>
    <div class="fb-period-segments" role="group" aria-labelledby="fb-tandem-period-label">
      @for (p of periods; track p) {
        <button type="button" class="fb-period-segment" [class.fb-period-segment--active]="p === period"
          [attr.aria-pressed]="p === period" (click)="selectPeriod(p)">{{ p === 'total' ? (student.period.total) : p }}</button>
      }
    </div>
  </div>
  <div class="fb-stats-strip">  <!-- two .fb-stat-tile, order: flights, passengers -->
  <mat-card appearance="outlined" class="fb-card fb-card--passengers">...</mat-card>
  <mat-card appearance="outlined" class="fb-card fb-card--flights">...</mat-card>
</div>
} @else { <p class="fb-no-pilot">{{ tandemPilot.noTandemPilotSelected }}</p> }
```

The detail is flat: no `mat-expansion-panel`. **Passengers come before Flights** (M:192 before M:360),
which reverses today's order.

| Element | Values |
|---|---|
| `.fb-detail-header` | Copy `_student-page.scss:286-309`. Padding `18px 24px` (M:151) |
| Back, action buttons | 36×36, radius 9px. Copy `:311-352`, `:401-412`. Back icon 19px, action icon 17px |
| Role | 10px/600, 0.14em uppercase, `--fb-text-3` (M:159) |
| `h1` | 26px/600, 1.05, -0.025em, margin `8px 0 0` (M:164) |
| `.fb-period-bar` | Padding `12px 24px`, white, border-bottom `--fb-surface-variant` (M:174). Copy `:422-439` |
| `.fb-period-segment` | Now a `<button>`: `flex:none; min-width:78px; padding:9px 14px; border:0; border-left:1px solid var(--fb-border-subtle); background:transparent; font:inherit; font-size:12px; font-weight:500; color:var(--fb-text-2); cursor:pointer`. Active: `background:var(--fb-primary); font-weight:600; color:var(--fb-on-primary)` (M:1395-1398) |
| Stats | Copy `:469-501`. Tile padding `16px 18px`, value 22px/600, label 9.5px/500 0.1em uppercase |
| Tile labels | `student.amountofflights`, `tandemPilot.passengers` |
| Tile values | `flightsPagerEntity.totalItems ?? '–'`, `passengerConfirmationsPagerEntity.totalItems ?? '–'` |

### 3.3 Passengers card (M:193-236)

```html
<div class="fb-card__header"><h2 class="fb-card__title">{{ tandemPilot.passengerConfirmations }}</h2></div>
<div class="fb-table-scroll fb-table-scroll--passengers">
  <table mat-table [dataSource]="passengerConfirmations"> columns unchanged </table>
  @if (!passengersLoading && passengerConfirmations.length === 0) { .fb-empty-state, passengerConfirmation.noData }
</div>
<mat-paginator #passengerConfirmationsPaginator ...unchanged bindings />
```

| Element | Values |
|---|---|
| Card | `margin:18px 24px 0` (M:193); copy `.fb-card` from `_student-page.scss:506-525` (radius 12px, `overflow:hidden`) |
| Header | Padding `15px 18px`, border-bottom `--fb-surface-variant`; title 13.5px/600 |
| Table | `min-width:880px` (M:199) |
| `th` | 10px/600, 0.1em uppercase, `--fb-text-3`, `--fb-fill-subtle`, padding `11px 14px`, first/last column `11px 18px`; date and ads `nowrap` |
| `td` | Padding `13px 14px`, first/last `13px 18px`, border-bottom `--fb-surface-variant` |
| Date | 12.5px, tabular-nums, `--fb-text-3`, nowrap |
| Name | 13px/500, `--fb-ink`, nowrap |
| Place, email | 12.5px, `--fb-text-2` |
| Phone | 12.5px, tabular-nums, `--fb-text-2`, nowrap |
| `.fb-ads-pill` | `display:inline-flex; padding:2px 8px; border-radius:5px; font-size:11px; font-weight:600`. Yes: bg `--fb-success-hover-bg` (#e6f4ec), `--fb-success-fg`. No: bg `--fb-bg`, `--fb-text-3` (M:1379-1382) |

Header label stays `passengerConfirmation.canUseData` ("Werbung"/"Publicité").

### 3.4 Flights card (M:360-458)

Column order for `buildDisplayedFlightColumns()`:

```ts
['paymentButtons', 'nb', 'date', 'start', 'landing', 'glider', 'time', 'km', 'description',
 ...customFieldKeys, 'instructor', 'paymentAmount', 'paymentState']
```

| Column | Header key | Cell |
|---|---|---|
| `paymentButtons` | blank, as `.validation-actions` on Students | `.fb-flight-actions` wrapper div, two `.fb-flight-action` buttons |
| `nb` | `student.flight.number` | `element.number`, 12.5px/600 `--fb-ink` |
| `date` | `student.flight.date` | `dd.MM.yyyy`, nowrap |
| `start`, `landing` | existing | `?.name` |
| `glider` | `student.flight.glider` | `{{element.glider?.brand}} {{element.glider?.name}}`, `--fb-text-3` |
| `time` | `student.flight.time`, `.numeric` | Unchanged split expression |
| `km` | `student.flight.km`, `.numeric` | `element.km` |
| `description` | existing | `min-width:200px; line-height:1.45` |
| custom field | `customField.label`, nowrap | Unchanged `formatCustomFieldValue(getCustomFieldValue(...))` |
| `instructor` | `student.flight.instructor` | `@if (element.tandemSchoolData?.instructor; as i)` then `{{ i.firstname?.charAt(0) }}. {{ i.lastname }}`, else `-`; `--fb-text-3`, nowrap |
| `paymentAmount` | existing, `.numeric` | Unchanged |
| `paymentState` | existing | `.fb-state-pill` |

| Element | Values |
|---|---|
| Card | `margin:16px 24px 24px` (M:360) |
| Table | `min-width:1080px` (M:373); wraps in `.fb-table-scroll` with `overflow-x:auto` |
| Header and data cells | As §3.3, `th` padding `11px 14px`, `td` padding `13px 14px` |
| `.fb-row--pending` | On `mat-row` when `!row.tandemSchoolData?.paymentState`: `background:var(--fb-warn-bg)` (M:1210). Binding, not a `when` |
| `.fb-flight-actions` | Inner div: flex, gap 6px, min-width 62px; cell `width:1%; nowrap`. No flex on the `<td>` (INIT §4) |
| `.fb-flight-action` | Copy `_student-page.scss:1164-1202`: 28×28, 15px icon. `--validate` icon `check`, `--reject` icon `close` |
| `.fb-state-pill` | `display:inline-block; padding:3px 8px; border-radius:99px; font-size:9px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; white-space:nowrap` (M:1158) |
| `--paid` | bg `--fb-success-bg`, `--fb-success-fg` |
| `--rejected` | bg `--fb-danger-bg`, `--fb-on-danger-bg` |
| `--pending` | bg `--fb-bg`, `--fb-text-3` |
| `mat-paginator` | bg `--fb-fill-subtle`, border-top `--fb-surface-variant` |

Pending, as today: `!paymentState || paymentState === ''`. The pill keeps today's `matTooltip`
bindings, on the pill `<span>`.

The header has no action button: no Validate all.

### 3.5 Dialogs

The mockup has no export or payment dialog. Model both on `appointment-form-dialog`. Styles go in each
dialog's own `.scss`, with `@use '@angular/material' as mat;`.

Shared rules, from `appointment-form-dialog.component.scss`:
- `[mat-dialog-title]`: 17px/600, `--fb-ink`
- `mat-form-field`: `appearance="outline"`, `width:100%`, `padding-top:5px` (label clipping),
  `mat.form-field-overrides` with `container-height:40px`, `container-vertical-padding:8px`,
  `outlined-label-text-size:11px`, `outlined-label-text-weight:600`,
  `outlined-label-text-tracking:0.06em`, `outlined-label-text-color:var(--fb-text-3)`,
  `outlined-container-shape:9px`; `.mdc-floating-label { text-transform:uppercase }`
- `mat-dialog-actions`: bg `--fb-fill-subtle`, border-top `--fb-surface-variant`
- Buttons: `mat-raised-button` Cancel + `mat-raised-button color="primary"` confirm, as that dialog
- Remove `min-width` from `mat-dialog-content`. The old 400px overflows on phones.
- Pass `panelClass: 'fb-email-dialog-panel'` at all three `open()` calls for the 12px shape. The name is
  misleading but it is the only existing global, and it stays as is.

Export (`export-dialog.component.html`): wrap both fields in `.fb-form-row` (`display:flex; gap:14px`,
each field `flex:1; min-width:0`), stacked at `max-width:768px`. Change the Cancel button from
`mat-button` to `mat-raised-button`. Add `floatLabel="always"`. Keep `mat-error` blocks and validator
unchanged. `width:'500px'` stays.

Payment (`payment-form-dialog.component.html`): `appearance="outline"` on both fields; keep the
`data.paymentState === 'PAID'` gate on amount; keep `[(ngModel)]`; keep `rows="4"`. Keep the flex column
and 16px gap on content.

### 3.6 SCSS housekeeping

- `tandem-pilots.component.scss` and `tandem-pilot-detail.component.scss`: only a pointer comment, as
  `students.component.scss`.
- `_tandem-page.scss`: header comment as the Appointments partial, every selector under
  `.fb-tandem-page`, `height:100%`, `background:var(--fb-bg)`, Sora stack, `--fb-ink`. Include
  `mat-sidenav-content { background:var(--fb-bg) }`.
- Do not copy anything for level, control sheet, notes, emergency, reject box, star rating.
- `:focus-visible` outlines as Students (`2px solid var(--fb-focus-ring)`).

---

## 4. States

| State | Behaviour |
|---|---|
| No pilots, Active tab | `.fb-empty-list` with `tandemPilot.noTandemPilots`; detail shows `.fb-no-pilot` |
| No pilots, Archived tab | Same |
| No pilot selected | Only after school change or empty list. `.fb-no-pilot` with `tandemPilot.noTandemPilotSelected`: `padding:24px`, centred, 600, `--fb-text-3` |
| List loading | No spinner, as Students |
| Pilot or period changing | Clear `flights`, `passengerConfirmations` and both pager entities first, set `flightsLoading`/`passengersLoading`. Tiles show `–`. Clear flags in `finalize`. Empty state is suppressed while loading, so it does not flash |
| Paging | Do not clear; rows swap on response |
| Stale response | Keep the `Subscription` per table and unsubscribe before a new load, in addition to `takeUntil`. Rapid pilot or period clicks must not show older data |
| Empty tables | Table header, `.fb-empty-state` (icon `list_alt`, `student.flight.noData` / `passengerConfirmation.noData`), paginator stays rendered, as Students |
| Empty year | Same as empty tables; tile shows `0` |
| Archived pilot | Reached via Archived tab. No archive button; export stays. Payment buttons stay enabled as today. Flights limited by API to `timestamp <=` archive time (api:`tandem-pilot.facade.ts:73-75`); confirmations are not, so counts can reflect different cut-offs. Not surfaced in UI |
| Pending flight | `.fb-row--pending`, pill `--pending`, `student.flight.paymentState.PENDING` |
| Paid flight | Pill `--paid`; amount shown; buttons stay visible (D6) |
| Rejected flight | Pill `--rejected`; buttons stay visible |
| Payment comment | Tooltip on the pill, any state; disabled when no comment |
| No custom fields | Column list is base columns only |
| Several custom fields | Extra columns between `description` and `instructor`; table scrolls horizontally. Keys are UUIDs (`custom-field-dialog.component.ts:115`), so they cannot clash with the new `nb`/`glider`/`km`/`instructor` defs. Disabled fields stay excluded |
| Mobile ≤768px | List full width; selecting closes the sidenav; back button reopens; widening reopens through the `effect`; tables scroll inside `.fb-table-scroll`; header wraps |
| `tandemModule` gating | Nav links gated at `main.component.html:16,63`; unchanged. Route has no guard; unchanged. The page reads nothing else from the flag |

---

## 5. Behaviour that must survive unchanged

List (`tandem-pilots.component.ts`):
1. `GET /schools/:id/tandem-pilots?archived=` on init, tab change, school change, after archive.
2. First pilot auto-selected after each sync.
3. School change clears selection and reloads the current tab.
4. Add: `EmailDialogComponent` with title `tandemPilot.addTandemPilot`, `width:"500px"`; on `event==="send"`
   run duplicate check, then `POST .../tandem-pilots/enrollment`; snackbars `formMessage.emailAlreadyAdded`
   and `formMessage.requestSent` with their current options.
5. Export all: `ExportDialogComponent` titled `export.exportAllPilotsData`; `forkJoin` active plus archived;
   per pilot `getAllTandemPilotFlights` + `getAllPassengerConfirmations`; `customFields` non-disabled;
   `exportAllTandemPilotsData(...)`.
6. `backButton()` reopens the sidenav; on mobile `tandemPilotDetail()` closes it.

Detail (`tandem-pilot-detail.component.ts`):
7. `ngOnChanges`: rebuild columns on `school`; load both tables on `tandemPilot`.
8. Flights paging: `limit` default 5, `[pageSizeOptions]="[5, 10, 20, 50]"`, `handleFlightsPage`, offset =
   `pageIndex * pageSize`, page index reset when no offset. Same for confirmations.
9. Payment: `check` opens dialog with `PAID`, `close` with `REJECTED`, `width:'500px'`, data `{ paymentState }`.
   On result assign `flight.tandemSchoolData` with the same null mapping, `PUT .../flights/:flightId`, then
   `loadFlights()`. Cancel writes nothing.
10. Archive: `confirm()` with `$REPLACE_NAME` replacement, `DELETE .../tandem-pilots/:id`, then
    `removeUserButtonClick` which runs `syncTandemPilotList(selectedTabIndex === 1)`, so it reloads the
    tab on screen (`false` on the normal path, because archive is only offered for active pilots).
11. Export pilot: `ExportDialogComponent` titled `export.exportPilotData`; both "all" calls;
    `exportTandemPilotData(...)`. **Period does not affect exports**; `getAll*` methods stay unfiltered.
12. Custom field value lookup and `formatCustomFieldValue` for `date`, `boolean`, `number`, `text`, `dropdown`.
13. `isMobile` back button; `backButtonClick` output. Outputs and inputs keep their names.

Add `ngOnDestroy` to the detail (`unsubscribe$` is never fired today).

`export-tandem-data.service.ts` is not edited.

**CDK table check.** Neither tandem table has a `when` row: payment uses a dialog, not the mockup's inline
reject row. So `multiTemplateDataRows` and `renderRows()` are **not** required, and must not be added.
Do **not** port the inline reject box: if anyone adds a `when` row driven by component state, INIT §4
applies and it needs both. `.fb-row--pending` and the pill are plain bindings and update on change
detection. Reviewers: confirm `managePaymentModal` still reloads via `loadFlights()`, and exercise a payment
in the running app.

---

## 6. i18n

New keys, added to both files:

| Key | de | fr |
|---|---|---|
| `tandemPilot.roleLabel` | Tandempilot | Pilote biplace |
| `tandemPilot.noTandemPilots` | Keine Tandempiloten vorhanden. | Aucun pilote biplace. |
| `tandemPilot.archiveTandemPilot` | Tandempilot archivieren | Archiver le pilote biplace |
| `tandemPilot.passengers` | Passagiere | Passagers |
| `student.flight.paymentState.markPaid` | Als ausbezahlt markieren | Marquer comme payé |
| `student.flight.paymentState.markRejected` | Zahlung ablehnen | Refuser le paiement |

Existing keys reused: `tandemPilot.{addTandemPilot,actif,archived,noTandemPilotSelected,passengerConfirmations,archiveTandemPilotMessage}`,
`passengerConfirmation.*`, `student.period.{label,total}`, `student.sort.{sortBy,firstname,lastname}`,
`student.amountofflights`, `student.backToList`, `student.flights`,
`student.flight.{number,date,start,landing,glider,time,km,description,instructor,noData}`,
`student.flight.paymentState.{label,amount,comment,PAID,REJECTED,PENDING}`,
`export.{exportPilotData,exportAllPilotsData,startDate,endDate,startDateRequired,endDateRequired,dateRangeInvalid}`,
`buttons.{cancel,save,export,yes,no,done}`, `formMessage.{emailAlreadyAdded,requestSent}`.

`student.flight.validationActions` loses its use here; leave it, Students-side files are untouched.

---

## 7. Accepted deviations and report-only items

### 7.1 Deviations from the mockup. Do not "fix"

| # | Deviation | Why |
|---|---|---|
| D1 | Active/Archived tabs shown; mockup has `showTabs` false (M:1371) | Archive is real; removing tabs would strand archived pilots. No counts, because the archived list is only loaded on demand and would show a false 0 |
| D2 | Two stat tiles (Flights, Passengers), not six | §2. Airtime, Average, Confirmed, Open have no truthful source |
| D3 | No `to check` pill in the list | §2 |
| D4 | Sort offers first and last name only | §2 |
| D5 | No Solo column | No tandem write endpoint; not meaningful for tandem |
| D6 | Payment columns replace Validation; actions open a dialog; both buttons always visible, action column never hidden; no inline reject box | Payment is the real workflow; hiding buttons would remove correction of a paid/rejected flight (same reasoning as INIT §5) |
| D7 | No Validate all | No endpoint |
| D8 | Payment amount and custom field columns added | Real data absent from the mockup |
| D9 | `download` in the header print slot; no print | Print has no tandem function; export exists |
| D10 | Export-all button beside Add in the list pane | Mockup's toolbar download is the shell's general export, a different function |
| D11 | List pane 320px, mockup 330px | Same width as Students so the pane does not jump between pages |
| D12 | `mat-paginator` instead of the mockup pager; no `Rows 5` label | Same as Students and Appointments; page size choice must survive |
| D13 | Sort keeps Material floating label, 44px | INIT §5 |
| D14 | Tooltip shows the raw comment on any state; no `Rejected:` prefix, no `Rejected without comment` | Existing behaviour |
| D15 | Small `#6c8394` text becomes `#5b7284` | INIT §5 |
| D16 | Period segments are computed (`Total`, current year, previous year), mockup has literal `2026`/`2025` | Must stay correct next year |
| D17 | Instructor column shows who recorded the payment | Only populated instructor on this endpoint |

### 7.2 Report only. Existing defects, not fixed here

- **Export silently truncates flights to the newest 100** per pilot: no limit sent, api:`flight/flight.facade.ts:60-62`. Date filtering happens client-side afterwards.
- **Export likely drops the last day of the range**: `new Date('YYYY-MM-DD')` is UTC, `endDate` is local midnight (`export-tandem-data.service.ts:306-307`). Inferred from source, not run.
- Duplicate check compares a lowercased stored email with the raw input, and only against active pilots (`tandem-pilots.component.ts:130`).
- "Export all" with no pilots closes silently (`:193-195`).
- After a payment save the table returns to page 1 with 5 rows.
- `PaymentDialogData` declares `{ flight }` while callers pass `{ paymentState }`.
- `/tandem-pilots` has no route guard for `tandemModule`.
- The `filter` leak in `createFilterParams` remains for appointments, where it is intended; §3.0 removes tandem from it.

---

## 8. Acceptance checklist

Build and types
1. `npx tsc --noEmit -p tsconfig.app.json` passes.
2. `npm run build` passes with no new budget error.
3. `de.json` and `fr.json` both contain all six new keys.

Static
4. `grep -rn "ng-deep" ` on the tandem page, detail, export and payment `.scss` and `_tandem-page.scss` finds nothing.
5. No global `.card` rule; no `class='card'` left in tandem templates.
6. `MatBadgeModule`, `MatListModule`, `MatTabsModule`, `MatExpansionModule` are absent from tandem imports; `.mat-table` selector is gone.
7. No clickable `<mat-icon>`; every icon-only button has an `aria-label`.
8. Every `<td>` in the detail template is closed.
9. `_tandem-page.scss` has one root selector `.fb-tandem-page`, and is `@use`d in `src/styles.scss`.
10. Tandem page and detail `.scss` contain only a pointer comment.
11. Only `@media (max-width: 768px)` breakpoints are used.
12. No `OnPush`; components still `standalone: true`.
13. No `#6c8394`/`--fb-text-4` on text under 18px.
14. `school.service.ts` diff touches only the two paged tandem methods plus one new private helper.
15. `multiTemplateDataRows` and `renderRows` are absent from the tandem detail.

Runtime, with a running app
16. Visit Appointments, then Tandem pilots: flights and confirmations load fully, network shows no failed call, and no `state`/`order` params.
17. Default period is the current year; both tables and both tiles reflect it.
18. Each period sends `from`+`to` together, or neither for Total, on both calls, and resets to page 1.
19. Selecting another pilot keeps the period.
20. Rapidly switching pilots leaves the last clicked pilot's data on screen.
21. Passengers card sits above Flights.
22. Page size and paging work on both tables.
23. Paid: dialog with amount and comment saves; table reloads; pill and amount update; comment tooltip appears.
24. Rejected: dialog has no amount field; saves; pill updates.
25. Cancel in the payment dialog changes nothing.
26. A paid flight can be changed to rejected.
27. Pending row has the cream background; paid and rejected do not.
28. A school with several custom fields shows their columns and values, and the table scrolls horizontally.
29. A school with no custom fields renders without console errors.
30. Archive: `confirm()` appears; on OK the pilot moves to Archived; on Cancel nothing happens.
31. Archived tab lists the pilot, without an archive button; tab keyboard navigation works.
32. Export pilot and export all each produce a workbook with both sheets.
33. Add tandem pilot: duplicate snackbar and request-sent snackbar both work; dialog has 12px corners.
34. Export dialog: required and invalid-range errors show; dates stack at ≤768px; no horizontal overflow on a 360px viewport.
35. School with no pilots shows both empty messages; year with no flights shows empty states and `0`.
36. At ≤768px, select, back and resize to desktop all work.
37. Switching school clears selection and reloads the current tab.
38. Sort by last name, then archive or switch tab: order stays correct.
39. Switching language to fr shows no raw keys.

---

## 9. Reviewer guidance

Both reviewers: anything in §7 is not a finding. `npm test` cannot run (INIT §4), so do not ask for
specs or test runs. Do not reopen §1.

### Design-fidelity reviewer

Check against §3 and the mockup. Do **not** file:
- Anything in §7.1
- Missing hover states or media queries the mockup does not define
- Export and payment dialogs differing from a mockup that does not contain them; judge them against `appointment-form-dialog`
- `#5b7284` where the mockup says `#6c8394`
- The selected list row differing from Students; §3.1 follows the mockup
- `border-left` on the first period segment; it is literal, M:1395
- Paginator appearance
- Sub-pixel differences; the user accepts non-pixel-exact results

File: wrong order of cards, wrong token, missing pill, missing state from §4, tile showing a value with no real source.

### Code-quality reviewer

Check repo conventions, Material usage, accessibility, scope. Do **not** file:
- The `fb-*` vocabulary duplicated between partials
- Lack of a shared partial, or of a shared dialog base
- `panelClass: 'fb-email-dialog-panel'` used on non-email dialogs
- Default change detection; `standalone` differing from Students' NgModule
- `isExamReady`-style duplication in Students
- Native `confirm()`
- Items in §7.2, unless the change made them worse
- `MatDialogModule` left in the detail imports
- The `school.service.ts` edit, if it stays within §3.0
- `getActiveCustomFields()` being called from the template (existing)

File: `::ng-deep`, leaks outside `.fb-tandem-page`, misspelled `mat.*-overrides` keys (verify against
`node_modules/@angular/material/**/_m3-*.scss`), a lost action from §5, subscriptions without
`takeUntil`, new `when` rows, period filters reaching exports, `from` without `to`.

---

## 10. Open questions

**Coordinator decision: all five are closed with the recommended answer.** The `school.service.ts` edit
is allowed exactly as §3.0 describes (the leak and the API's `from`/`to` behaviour were verified in
source). These are settled; reviewers must not reopen them.

1. **`school.service.ts` is not in the listed scope, but §3.0 needs it.** It is the only way to make Period
   work, and it also fixes the leak from Appointments, which looks like a live bug on this branch.
   **Recommended: allow it** as written in §3.0.
2. **Show an estimated "Open confirmations" (`flights − confirmations`)?** There is no link between a
   flight and a confirmation, so it would be a guess shown as a fact.
   **Recommended: omit**, as specified. A truthful figure needs an API change.
3. **Airtime and Average through a one-pilot fetch with a large `limit`, summed in the client?** Feasible
   with no API change: one extra request per selection and period. INIT rejected client-side derivation for
   students on backend-load grounds.
   **Recommended: omit**, as specified. A real `tandem-school-id` statistic endpoint is the proper fix.
4. **Instructor column.** It shows who recorded the payment, under the label "Fluglehrer*in"/"Instructeur".
   **Recommended: keep with the existing label.** If the user finds it misleading, drop the column.
5. **Default period = current year** follows M:1121 but hides older rows on arrival, unlike today.
   **Recommended: follow the mockup.** Pilots with no flights this year show empty tables until Total is clicked.
