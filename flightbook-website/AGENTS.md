# Flightbook Website — Agent Instructions

## Project Overview

This is the marketing website for **Flightbook** (flightbook.ch), a paragliding logbook
app for iOS and Android. It started from the open-source AstroWind template but has been
redesigned into a purpose-built, three-locale marketing site; most of the generic template
guidance below no longer applies and has been removed or replaced.

**Stack:** Astro v6 | Tailwind CSS v4 | TypeScript 5.9 | Vitest | Sharp

The site builds to fully static output (`output: 'static'` in `astro.config.ts`).

## Quick Reference

| Command              | Purpose                                         |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Start dev server at localhost:4321              |
| `npm test`           | Run the Vitest suite once                       |
| `npm run test:watch` | Run Vitest in watch mode                        |
| `npm run build`      | Production build to `./dist/`                   |
| `npm run preview`    | Preview production build locally                |
| `npm run fix`        | Auto-fix ESLint + Prettier issues               |
| `npm run check`      | Run astro check + ESLint + Prettier (read-only) |

**Node.js requirement:** >= 22.12.0

Run `npm run fix` **before** `npm run check` — `check` includes `prettier --check`, which
fails on anything `fix` would have reformatted.

## Architecture

### Directory Structure

```
src/
  assets/styles/tailwind.css   # Tailwind v4 config: @theme tokens, @utility classes
  components/
    FlightbookHome.astro   # Composes the six homepage sections; shared by all 3 locale pages
    CustomStyles.astro     # :root CSS variables — fonts and colors (no dark variant)
    common/        # Shared: Image, Metadata, Analytics, LanguageSwitcher, ToggleMenu
    ui/            # Primitives: Button, Headline, WidgetWrapper, PhoneFrame, ImageCarousel
    widgets/       # Page sections: Header, Footer, Flightbook{Hero,PremiumFeatures,
                   #   Pricing,SchoolsFeatures,Tandem,FAQ}, plus unused AstroWind widgets
    blog/          # Blog components — present but dormant, see "Blog" below
  content.config.ts     # Content Collections schema (post collection only)
  content/i18n/{de,fr,en}.json   # The three translation tables
  data/post/             # Blog posts (.md/.mdx) — dormant, see "Blog" below
  layouts/               # Layout.astro (HTML shell), PageLayout.astro (adds header/footer),
                          # LandingLayout.astro, MarkdownLayout.astro
  pages/                 # File-based routing: root = de, /fr, /en (each a thin metadata wrapper)
  utils/                 # i18n.ts, language-detector.ts, blog.ts, images.ts, permalinks.ts
  test/render.ts         # Shared Astro Container test harness
  navigation.ts          # getHeaderData(locale) / getFooterData(locale)
  config.yaml            # Site configuration (loaded as virtual module)
vendor/integration/      # Custom Astro integration that loads config.yaml
```

### Path Aliases

Use `~/` to import from `src/`:

```typescript
import Image from '~/components/common/Image.astro';
import { SITE } from 'astrowind:config';
```

### Configuration System

Site config lives in `src/config.yaml` and is loaded as a Vite virtual module
`astrowind:config` by the custom integration in `vendor/integration/`. Exports: `SITE`,
`I18N`, `METADATA`, `APP_BLOG`, `UI`, `ANALYTICS`.

Note: `astro.config.ts` also has Astro's _built-in_ `i18n` block (`locales: ['de', 'fr',
'en']`, `defaultLocale: 'de'`). Nothing in `src/` imports `astro:i18n` or reads
`Astro.currentLocale` — routing and translation are handled entirely by
`src/utils/i18n.ts` and the locale-specific files under `src/pages/`. That built-in block
is vestigial (left over from the template) and unused; don't take it as the source of
truth for supported locales, even though its `locales` array happens to list all three.

## Internationalisation

Three locales: **`de`** (root, no prefix), **`fr`** (`/fr`), **`en`** (`/en`). Astro's
built-in i18n routing is not used for this — each locale has its own thin page under
`src/pages/` (`index.astro`, `fr/index.astro`, `en/index.astro`, and similarly for
`help.astro`, `privacy-policy.astro`).

- `src/content/i18n/{de,fr,en}.json` are the three translation tables. **They are
  structurally identical and indexed positionally** by components (e.g. `features.captions[i]`
  paired with the i-th screenshot import in `FlightbookHome.astro`). This positional pairing
  is load-bearing — reordering or shortening one locale's array without doing the same to
  the other two silently breaks that locale's captions/alt text.
- `src/utils/i18n.ts` exports `type Locale = 'de' | 'fr' | 'en'`, `getTranslations(locale)`,
  and `getLocaleFromUrl(url)`. `getLocaleFromUrl` matches a whole first path segment (so
  `/french-alps` is not misread as `/fr`).
- `src/layouts/PageLayout.astro` calls `getLocaleFromUrl(Astro.url)` and passes the result
  as the `locale` prop into `src/layouts/Layout.astro`, which uses it for `<html lang=...>`.
  **Do not read `I18N.language` from `astrowind:config` for per-page output** — that was a
  real bug where `/fr` shipped `lang="de"`. `I18N` is still used for the (locale-independent)
  `textDirection`.
- `src/utils/language-detector.ts` splits pure decision logic (`resolveRedirectTarget`,
  fully unit-tested) from the DOM-touching wrapper (`initLanguageDetection`, called from a
  `<script>` on each locale's `index.astro`) so the redirect rules are testable without a
  browser.
- `src/navigation.ts` builds header/footer nav data per locale from the same tables.

## Theming — there is no dark mode

`ui.theme` in `src/config.yaml` is `light:only`. `ApplyColorMode.astro` and
`ToggleTheme.astro` still exist as files under `src/components/common/` but are **not
imported anywhere** — they are dead code left from the template, not a live feature.
`Layout.astro` no longer renders `ApplyColorMode`, and the `.dark { ... }` variable block
is gone from `CustomStyles.astro`.

The `@variant dark (...)` declaration is still present in `tailwind.css`, and several
`ui`/`widgets` components (including some `@utility` classes in `tailwind.css` itself, e.g.
`btn`, `btn-primary`) still carry `dark:` classes. **These are inert**, not a bug to fix
either direction: since `.dark` is never applied to any element, the classes never
activate. Leave them alone — don't strip them (upstream compatibility) and don't wire up
dark mode to "activate" them.

### Palette

Design tokens live in `@theme` in `src/assets/styles/tailwind.css` — this is the source of
truth for section colours, not `CustomStyles.astro`. Notable tokens: `ink`, `surface-dark`,
`card-dark`, `surface-light`, `heading`, `body`, `muted-light`, `hairline`,
`hairline-strong`, `sky`, `sky-soft`, `sky-pale`, `brand`. Custom button utilities:
`btn-gradient`, `btn-gradient-hover`, `btn-on-dark`, `btn-outline-light`.

`--aw-color-primary` (set in `CustomStyles.astro`) is `#2f6df6`, not the AstroWind
template's navy default.

### Fonts

Space Grotesk (headings) and Inter (body), both self-hosted via `@fontsource-variable/*`
and imported in `CustomStyles.astro`.

## Homepage Structure

`src/components/FlightbookHome.astro` composes six sections, in this fixed order, and is
`<script>`-free itself — it's shared verbatim by `src/pages/index.astro`,
`src/pages/fr/index.astro`, and `src/pages/en/index.astro` (each just supplies `locale` and
page metadata):

| Order | Component                         | Anchor id  | Nav label (`de`)   |
| ----- | --------------------------------- | ---------- | ------------------ |
| 1     | `FlightbookHero.astro`            | `#top`     | —                  |
| 2     | `FlightbookPremiumFeatures.astro` | `#premium` | "Funktionalitäten" |
| 3     | `FlightbookPricing.astro`         | `#angebot` | "Pricing"          |
| 4     | `FlightbookSchoolsFeatures.astro` | `#schools` | "Schools"          |
| 5     | `FlightbookTandem.astro`          | `#tandem`  | "Tandem"           |
| 6     | `FlightbookFAQ.astro`             | `#faq`     | "FAQ"              |

**The id/label mismatch on the first two sections is deliberate**: `#premium` is labelled
"Funktionalitäten" (Features) and `#angebot` is labelled "Pricing". Do not rename either
id to match its label — both anchors are frozen because they're inbound-linked.

## Components

- `widgets/` holds full page sections (`Flightbook*` are the ones actually used on the
  homepage; the rest — `Hero`, `Hero2`, `Features`, `Pricing`, `Steps`, etc. — are unused
  AstroWind template widgets kept around but not referenced from any page).
- `ui/PhoneFrame.astro` and `ui/ImageCarousel.astro` are the shared primitives behind every
  phone-mockup screenshot on the site. `PhoneFrame` takes `radius?: 'lg'|'md'|'sm'`.
  `ImageCarousel` takes an optional `frame` prop: `'lg'|'md'|'sm'` wraps the slides in a
  `PhoneFrame` bezel, `'figure'` wraps them in a bordered card shell, and omitting it
  renders the images bare.

**Rule that made `ImageCarousel` necessary:** client scripts must scope their queries to
their own root element (e.g. `root.querySelectorAll(...)` after `root` comes from iterating
`[data-carousel]` roots), never a single page-global `document.querySelector` for the
per-instance elements (slides, dots, arrows). Multiple carousels repeat on one page — a
global selector for slides/dots/arrows makes one instance's controls drive another
instance's slides. It's fine to use `document.querySelectorAll` once to enumerate the
carousel roots themselves; everything scoped _inside_ a given carousel must be queried off
that root.

`<ClientRouter fallback="swap" />` is enabled in `Layout.astro`, so any client-side init
must:

- run on both the initial load and every subsequent `astro:page-load` event (and be
  idempotent — guard with a `data-*-ready` flag so re-running it on the same DOM is a no-op)
- tear down any timers/intervals on `astro:before-swap`, since ClientRouter can discard the
  DOM nodes a running `setInterval` still references

`ImageCarousel.astro`'s inline `<script>` is the reference implementation of both rules.

## Testing

Vitest. Test files live next to the code they test (`Foo.astro` → `Foo.test.ts`,
`foo.ts` → `foo.test.ts`). `vitest.config.ts` uses `getViteConfig` from `astro/config` so
Astro's Vite pipeline (aliases, `astrowind:config`, etc.) is available in tests.

`src/test/render.ts` wraps Astro's Container API:

- `render(Component, props, slots)` → rendered HTML string
- `count(html, pattern)` → number of matches, for asserting things like slide/heading counts

**Standard:** assert on contract — element counts, `href`s, `aria-*` attributes,
conditional branches, i18n text — and **never** on Tailwind class strings (they're
implementation detail and will churn). Where the fact under test is only visible in source,
not in rendered output (e.g. "this script never calls `document.querySelector` for a
per-instance element"), use an `fs.readFileSync` assertion against the component file
instead of a render assertion that would pass vacuously. See
`src/components/ui/ImageCarousel.test.ts` and
`src/components/widgets/FlightbookSchoolsFeatures.test.ts` for examples of that pattern.

`src/utils/i18n.test.ts` and `src/utils/language-detector.test.ts` cover locale resolution
and the redirect decision logic without touching the DOM.

`src/components/FlightbookHome.test.ts` renders the composed homepage per locale and
asserts the six section ids from the "Homepage Structure" table above appear in that exact
order, that `locale` is actually threaded through `getTranslations` (rendering `en`/`fr`
must not silently fall back to German content), and that nothing leaks a raw `undefined`
or `[object Object]` into the output. This is the test to extend if the frozen section
order or ids ever need to change.

## Blog — present but dormant

`apps.blog.isEnabled` is `false` in `src/config.yaml`. The blog components
(`src/components/blog/`), the `post` content collection (`src/content.config.ts`), the
posts under `src/data/post/`, and the `src/pages/[...blog]/` routes still exist and are
still wired up in code, but the flag means the blog does not currently generate any live
pages. Treat this area as dormant, not deleted — don't assume it's safe to rip out, and
don't spend effort "fixing" it as if it were live-facing.

## Content Collections

Defined in `src/content.config.ts` using the Astro v6 Content Layer API with the `glob()`
loader. Currently only the `post` collection (see "Blog" above). Post frontmatter: `title`
(required), `publishDate`, `updateDate`, `draft`, `excerpt`, `image`, `category`, `tags`,
`author`, `metadata`.

## Image Handling

`src/components/common/Image.astro` supports:

- Local images via `astro:assets` (optimized by Sharp)
- Remote images via Unpic CDN
- Allowed domains (for providers Unpic can't detect, processed by Sharp): `cdn.pixabay.com`

Hero images use `loading="eager"` and `fetchpriority="high"`.

## Known Gaps

- **Placeholder screenshot:** `FlightbookTandem`'s passenger-confirmation screenshot
  (`src/components/FlightbookHome.astro` imports `homeImg` from
  `~/assets/images/flightbook/home.png` and passes `screenshot={homeImg}` into it, at both
  its own call site and `FlightbookHero`'s) currently reuses the Home-screen screenshot
  rather than an actual passenger confirmation screen, and `tandem.screenshotAlt` in all
  three i18n tables describes the Home screen accordingly (e.g. German: "Flightbook App
  Startseite"). This is a known, intentional interim state, not a bug to silently "fix" by
  writing new alt text. Because `FlightbookHome.astro` is the single component shared by
  all three locale pages (see "Homepage Structure" above), swapping in the real screenshot
  is one edit in one file, not three.
- **Duplicate image files:** `flightbook/home-mobile.png` is byte-identical to
  `flightbook/home.png`, and `flightbook/place-mobile.png` is byte-identical to
  `flightbook/place.png`. Both pairs are imported separately in
  `src/components/FlightbookHome.astro` (once per breakpoint/context) — this is current,
  deliberate duplication in the working tree, not a broken symlink or accidental copy to
  clean up without checking with a human first.
- **No browser in this environment:** responsive layout and interactive behaviour (the
  carousel, mobile menu, language switcher) have been verified structurally (render
  assertions, source-level checks) rather than visually. A visual pass across the three
  locales at common breakpoints is still worth doing by a human or a tool with a real
  browser before treating the redesign as fully verified.
- **Astro's built-in `i18n` config** in `astro.config.ts` lists `locales: ['de', 'fr',
'en']` but is unused dead config (see "Configuration System" above) — nothing in `src/`
  reads it, so it isn't the source of truth for locales even though its list is currently
  complete.

## Verification Checklist

Run in this order — `check` includes `prettier --check`, so `fix` must go first:

1. `npm test` — Vitest suite must pass
2. `npm run fix` — auto-fixes ESLint/Prettier issues before the read-only check
3. `npm run build` — production build must succeed
4. `npm run check` — astro check + ESLint + Prettier, all must be clean

Beyond the command line: there is no browser in this environment (see "Known Gaps"), so a
visual check across all three locales (`/`, `/fr`, `/en`) at common breakpoints is a
manual/human step, not something these commands cover.
