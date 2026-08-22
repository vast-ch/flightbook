# Flightbook homepage redesign — design

**Date:** 2026-08-22
**Source design:** Claude Design project `e477f39f-b70b-45ef-a3d8-e03a1c360501`, file `Flightbook Redesign Foto.dc.html`
**Target:** `flightbook-website` (Astro v6 + Tailwind v4)

## Goal

Replace the flightbook.ch homepage with the "Redesign Foto" design: a photo-led dark
hero, an eight-card feature grid, a new Tandem section, and a restyled header and
footer. Add English as a third locale and refresh the French copy from the design's
own string tables.

## Decisions

Settled with Joel before this spec was written:

1. **Fixed section palette, no dark mode.** Every section renders with the design's
   own colors for all visitors. The light/dark theme machinery comes out.
2. **Three locales.** Add `en`, and replace the existing French copy with the
   design's rewritten French.
3. **Design copy verbatim,** with two corrections (see _Copy_).
4. **Photos are Joel's to supply.** Build against committed placeholders.

## Approach

Rewrite the five existing `Flightbook*.astro` widgets in place and add two new
sections, rather than building a parallel component library. The old widgets have no
consumers outside `src/pages/index.astro` and `src/pages/fr/index.astro`, so a
side-by-side migration would buy little and would force every i18n change to land
twice. Section boundaries in the design map almost 1:1 onto the existing files.

## Foundations

### Removing dark mode

- Delete the `.dark` block from `src/components/CustomStyles.astro`.
- Remove the `ApplyColorMode` import and element from `src/layouts/Layout.astro`
  (lines 9 and 35). This is the piece that actually applies the `.dark` class; CSS
  cleanup alone would not disable it.
- Set `ui.theme: 'light:only'` in `src/config.yaml`.
- Drop `showToggleTheme` from `PageLayout.astro` and `LandingLayout.astro`. `Header.astro`
  never declared or rendered that prop, so no toggle is being removed from the UI —
  only a dead prop.
- The rewritten Flightbook widgets shed their `dark:` variants as a side effect of
  the rewrite. Shared components that also carry `dark:` variants — `ui/Form.astro`,
  `ui/Headline.astro`, `ui/Timeline.astro`, `ui/WidgetWrapper.astro` — are left
  alone: with `.dark` never applied they are inert, and editing them is unrelated
  churn.

### Palette

Added as `@theme` tokens in `src/assets/styles/tailwind.css`.

| Role              | Value                                       |
| ----------------- | ------------------------------------------- |
| Ink / hero ground | `#05101d`                                   |
| Dark section      | `#0a1626`                                   |
| Dark card         | `#0d1b2d`                                   |
| Light section     | `#f5f8fc`                                   |
| Page white        | `#ffffff`                                   |
| Heading on light  | `#0b1626`                                   |
| Body on light     | `#4b5c6e`                                   |
| Muted on light    | `#7b8ea3`, `#5a6b7d`                        |
| Hairline on light | `#e4ebf3`, `#cbd8e6`, `#d5dfea`             |
| Accent sky        | `#38bdf8`, `#7dd3fc`, `#bae6fd`             |
| Accent blue       | `#2f6df6`                                   |
| CTA gradient      | `linear-gradient(120deg, #38bdf8, #2f6df6)` |

Text on dark uses white at `.74 / .62 / .6 / .5 / .45` opacity, per the design.

Radii: pills `999px`; cards `24px` (pricing), `22px` (feature grid), `18px` (FAQ,
school figures); phone frames `44px` (hero), `42px` (features), `36px` (tandem).

**`--aw-color-primary` moves from `rgb(27 62 113)` (navy) to `#2f6df6`.** This is a
deliberate brand change that also restyles `privacy-policy`, `help`, and `404`,
which consume `btn-primary` and `text-primary`. It matches the blue in the current
app icon.

### Typography

Space Grotesk (500/600/700) for headings, Inter for body — matching the design's
`font-family` declarations. Self-host via `@fontsource-variable/space-grotesk` to
match the existing `@fontsource-variable/inter` pattern. If that package is not
published as a variable font, fall back to `@fontsource/space-grotesk` with the
three static weights; do not use the design's Google Fonts `<link>`, which adds a
render-blocking third-party request.

## Components

### Rewritten

| File                                      | Change                                                                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `widgets/FlightbookHero.astro`            | Full-bleed photo, two gradient scrims, eyebrow pill, headline with gradient-clipped second line, iOS/Android/Premium CTAs, floating phone, 4-up stat strip |
| `widgets/FlightbookPremiumFeatures.astro` | Eight cards in a 2-col hairline grid + full-width CTA cell; sticky phone carousel with per-slide caption                                                   |
| `widgets/FlightbookPricing.astro`         | Light section; three cards, middle one dark and elevated with a radial glow                                                                                |
| `widgets/FlightbookSchoolsFeatures.astro` | Three alternating text/figure rows, two carrying carousels                                                                                                 |
| `widgets/FlightbookFAQ.astro`             | Custom `+`/`−` accordion, single-open; retains the existing `FAQPage` JSON-LD                                                                              |
| `widgets/Header.astro`                    | Dark glass sticky bar, logo, five anchors, Login dropdown, language pill, Registrieren button                                                              |
| `widgets/Footer.astro`                    | Gradient CTA band above the existing link columns                                                                                                          |
| `common/LanguageSwitcher.astro`           | Three-way DE/FR/EN pill                                                                                                                                    |

### New

- `widgets/FlightbookTandem.astro` — photo background, phone frame, four sub-features, CTA.
- `ui/PhoneFrame.astro` — the gradient bezel and inset screen, used in the hero, the
  features carousel, and Tandem. One prop for corner radius.
- `ui/ImageCarousel.astro` — shared slider.

### Why the carousel gets extracted

`FlightbookPremiumFeatures.astro` currently binds its controls with page-global
selectors (`document.querySelector('.slide-nav.prev')`, and `document.querySelectorAll('.slide')`).
The redesign puts three carousels on one page, so as written the hero-side arrows
would drive whichever slider appeared first in the DOM. `ImageCarousel.astro` scopes
every query to its own root element and replaces roughly 200 lines of near-duplicate
slider JavaScript in `FlightbookSchoolsFeatures.astro`.

The Login dropdown needs no JavaScript — `tailwind.css` already ships
`.dropdown:hover / :focus-within .dropdown-menu`.

## Page structure

Section order changes from Hero → Pricing → Premium → Schools → FAQ to:

1. Hero (`#top`)
2. Funktionalitäten (`#premium`)
3. Pricing (`#angebot`)
4. Schools (`#schools`)
5. Tandem (`#tandem`) — new
6. FAQ (`#faq`)

**Anchor ids are preserved even though the design's labels no longer match them**
(`#premium` is labelled "Funktionalitäten", `#angebot` is labelled "Pricing"). Renaming
the ids would break existing inbound links and bookmarks for no user-visible gain.

## Internationalisation

Extend `Locale` in `src/utils/i18n.ts` to `'de' | 'fr' | 'en'`.

- Add `src/content/i18n/en.json`; rewrite `fr.json` from the design's `FR` table;
  extend `de.json` with the four new feature cards and the Tandem section.
- Add `src/pages/en/index.astro`, `src/pages/en/privacy-policy.astro`,
  `src/pages/en/help.astro`.
- Add `headerDataEn` and `footerDataEn` to `src/navigation.ts`, and restructure the
  existing header data into five anchors plus a nested Login dropdown.
- Make `getLocaleFromUrl` and `src/utils/language-detector.ts` three-way.
- Widen `StructuredData.astro`'s `locale` prop to include `'en'`.

### Existing locale bug, fixed here

`Layout.astro` sets `<html lang={language}>` and passes `locale={language}` to
`StructuredData`, where `language` is the _global_ `I18N.language` from `config.yaml`
— always `de`. `/fr` therefore ships `lang="de"` and German structured data today.
Adding a third locale makes this more visible, so `Layout.astro` gains a `locale`
prop that `PageLayout` derives from the URL and passes down.

Add `en` to `i18n.languages` in `config.yaml`.

## Copy

All German, French, and English strings lift from the design's `FR` and `EN`
dictionaries and its inline German. Two corrections:

- `Fortschritt tracklen für Flugschüler` → `Fortschritt tracken für Flugschüler`.
- The feature card titled "Fortschritt tracken" describes Excel and PDF export, not
  progress tracking. Retitle it to match its body.

## Assets

The design is desktop-only: a hard-coded `88px` headline, fixed
`grid-template-columns`, no media queries. **Responsive behaviour at 375/768/1440 is
authored as part of this work, not copied from the mock.**

Build against committed placeholders. Joel supplies:

- Hero photo — wide landscape, paraglider over alps.
- Tandem photo — tandem flight.
- Five app screenshots at full resolution: Home, Statistics, Add flight, Places, and
  Passenger confirmation.

The screenshots cannot be retrieved from the design project: the MCP's `get_file`
caps responses at 256 KiB and each PNG (1179×2556) exceeds it. None of the five
byte-match the files currently in `src/assets/images/flightbook/`, so the existing
assets are not substitutes.

The Passenger-confirmation screenshot shows an email address and a full phone
number. They read as dummy data; confirm before it ships on a public page.

## Verification

1. `npm run build` succeeds.
2. `npm run check` passes — `astro check`, ESLint, Prettier.
3. Visual pass across all three locales at 375px, 768px, and 1440px.
4. `#angebot`, `#premium`, `#schools`, `#faq` still resolve from an external link.
5. `/`, `/fr`, `/en` each emit the correct `<html lang>` and locale-matched
   structured data.

## Out of scope

- The blog routes (`apps.blog.isEnabled` is `false`).
- `delete.astro`, and the Decap CMS config under `public/decapcms/`.
- Any change to the mobile app or its API.
