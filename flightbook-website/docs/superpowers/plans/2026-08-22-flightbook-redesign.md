# Flightbook Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flightbook.ch homepage with the "Redesign Foto" design — photo-led dark hero, eight-card feature grid, new Tandem section, restyled header and footer — and add English as a third locale.

**Architecture:** Rewrite the five existing `Flightbook*.astro` widgets in place and add two new sections, keeping `src/pages/*/index.astro` as thin composition layers. Two new shared primitives (`ui/PhoneFrame.astro`, `ui/ImageCarousel.astro`) absorb markup and JavaScript that would otherwise be triplicated. Dark mode is removed in favour of a fixed per-section palette.

**Tech Stack:** Astro v6, Tailwind CSS v4 (CSS-first config), TypeScript 5.9, Vitest (added in Task 1), Sharp via `astro:assets`.

**Spec:** `docs/superpowers/specs/2026-08-22-flightbook-redesign-design.md`

## Global Constraints

- Node.js `>= 22.12.0`.
- Path alias `~/` maps to `src/`. Config comes from the virtual module `astrowind:config`.
- Tailwind v4 is configured CSS-first in `src/assets/styles/tailwind.css`. There is no `tailwind.config.ts` to edit.
- **Anchor ids are frozen:** `#top`, `#premium` (labelled "Funktionalitäten"), `#angebot` (labelled "Pricing"), `#schools`, `#tandem`, `#faq`. The label/id mismatch on `#premium` and `#angebot` is deliberate — renaming breaks inbound links.
- **Section order:** Hero → Funktionalitäten → Pricing → Schools → Tandem → FAQ.
- No `dark:` variants in any file this plan creates or rewrites.
- Copy corrections applied everywhere: `tracklen` → `tracken`; the feature card whose body describes Excel/PDF export is titled for export, not "Fortschritt tracken".
- CTA gradient is exactly `linear-gradient(120deg, #38bdf8, #2f6df6)`.
- `npm run check` runs `prettier --check`. **Always run `npm run fix` before `npm run check`** or formatting will fail the gate.
- Never edit the mobile app or its API. This repo only.

---

### Task 1: Locale plumbing — three locales, correct `lang`, unit tests

Adds Vitest (per the workspace standard in CLAUDE.md — it is not currently installed), widens the locale type to three, and fixes the pre-existing bug where `/fr` ships `lang="de"`.

**Files:**
- Modify: `package.json` (add `vitest` devDependency + `test` script)
- Create: `vitest.config.ts`
- Modify: `src/utils/i18n.ts`
- Create: `src/utils/i18n.test.ts`
- Modify: `src/utils/language-detector.ts`
- Create: `src/utils/language-detector.test.ts`
- Create: `src/content/i18n/en.json` (minimal stub — full copy lands in Task 4)
- Modify: `src/layouts/Layout.astro:29-39`
- Modify: `src/layouts/PageLayout.astro:17-27`
- Modify: `src/components/common/StructuredData.astro:3-6`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Locale = 'de' | 'fr' | 'en'` from `~/utils/i18n`
  - `getTranslations(locale: Locale)` — unchanged signature, now three-way
  - `getLocaleFromUrl(url: URL): Locale`
  - `Layout.astro` accepts `locale?: Locale` (default `'de'`)
  - `StructuredData.astro` accepts `locale?: Locale`

- [ ] **Step 1: Add Vitest and the test script**

```bash
npm install -D vitest
```

Then in `package.json`, add to `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Write the failing tests for locale resolution**

Create `src/utils/i18n.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getLocaleFromUrl, getTranslations } from '~/utils/i18n';

describe('getLocaleFromUrl', () => {
  it('defaults to German at the root', () => {
    expect(getLocaleFromUrl(new URL('https://flightbook.ch/'))).toBe('de');
  });

  it('detects French', () => {
    expect(getLocaleFromUrl(new URL('https://flightbook.ch/fr'))).toBe('fr');
  });

  it('detects English', () => {
    expect(getLocaleFromUrl(new URL('https://flightbook.ch/en'))).toBe('en');
  });

  it('detects a locale on a nested path', () => {
    expect(getLocaleFromUrl(new URL('https://flightbook.ch/en/privacy-policy'))).toBe('en');
  });

  it('does not treat a prefix match as a locale', () => {
    expect(getLocaleFromUrl(new URL('https://flightbook.ch/french-alps'))).toBe('de');
  });
});

describe('getTranslations', () => {
  it('returns a distinct table per locale', () => {
    expect(getTranslations('de').nav.register).toBe('Registrieren');
    expect(getTranslations('en').nav.register).toBe('Sign up');
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `getLocaleFromUrl` returns `'de'` for `/en`, and `getTranslations('en')` is not a valid call because `Locale` excludes `'en'`.

- [ ] **Step 5: Create the English stub table**

Create `src/content/i18n/en.json` with only what Task 1's tests need. Task 4 replaces this file wholesale.

```json
{
  "nav": {
    "register": "Sign up"
  }
}
```

- [ ] **Step 6: Widen the locale type and fix prefix matching**

Rewrite `src/utils/i18n.ts`:

```ts
import deTrans from '~/content/i18n/de.json';
import frTrans from '~/content/i18n/fr.json';
import enTrans from '~/content/i18n/en.json';

export type Locale = 'de' | 'fr' | 'en';

const translations = {
  de: deTrans,
  fr: frTrans,
  en: enTrans,
};

export function getTranslations(locale: Locale) {
  return translations[locale] || translations.de;
}

export function getLocaleFromUrl(url: URL): Locale {
  // Match a whole first path segment, so /french-alps is not read as /fr.
  const segment = url.pathname.split('/')[1];
  if (segment === 'fr' || segment === 'en') {
    return segment;
  }
  return 'de';
}
```

Note: `en.json` is a stub at this point, so `getTranslations('en')` is structurally narrower than the other two. TypeScript infers a union of the three shapes; Task 4 makes them identical. If `astro check` complains before Task 4, that is expected and resolves there.

- [ ] **Step 7: Run the locale tests to verify they pass**

Run: `npm test -- src/utils/i18n.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 8: Write the failing tests for the language detector**

Create `src/utils/language-detector.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveRedirectTarget } from '~/utils/language-detector';

describe('resolveRedirectTarget', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends a first-time French browser from the root to /fr', () => {
    expect(
      resolveRedirectTarget({ path: '/', hash: '', langParam: null, isFirstVisit: true, storedLang: null, browserLang: 'fr-CH' })
    ).toBe('/fr');
  });

  it('sends a first-time English browser from the root to /en', () => {
    expect(
      resolveRedirectTarget({ path: '/', hash: '', langParam: null, isFirstVisit: true, storedLang: null, browserLang: 'en-GB' })
    ).toBe('/en');
  });

  it('leaves a first-time German browser alone', () => {
    expect(
      resolveRedirectTarget({ path: '/', hash: '', langParam: null, isFirstVisit: true, storedLang: null, browserLang: 'de-CH' })
    ).toBeNull();
  });

  it('never auto-redirects away from a deep link', () => {
    expect(
      resolveRedirectTarget({ path: '/privacy-policy', hash: '', langParam: null, isFirstVisit: true, storedLang: null, browserLang: 'fr-CH' })
    ).toBeNull();
  });

  it('honours the legacy ?lang= parameter', () => {
    expect(
      resolveRedirectTarget({ path: '/', hash: '#faq', langParam: 'en', isFirstVisit: false, storedLang: null, browserLang: 'de-CH' })
    ).toBe('/en#faq');
  });

  it('honours a stored preference on a return visit', () => {
    expect(
      resolveRedirectTarget({ path: '/', hash: '', langParam: null, isFirstVisit: false, storedLang: 'en', browserLang: 'de-CH' })
    ).toBe('/en');
  });

  it('returns null when the stored preference already matches the page', () => {
    expect(
      resolveRedirectTarget({ path: '/en', hash: '', langParam: null, isFirstVisit: false, storedLang: 'en', browserLang: 'de-CH' })
    ).toBeNull();
  });

  it('sends a stored German preference back to the root', () => {
    expect(
      resolveRedirectTarget({ path: '/fr', hash: '', langParam: null, isFirstVisit: false, storedLang: 'de', browserLang: 'fr-CH' })
    ).toBe('/');
  });
});
```

- [ ] **Step 9: Run the detector tests to verify they fail**

Run: `npm test -- src/utils/language-detector.test.ts`
Expected: FAIL with "resolveRedirectTarget is not a function" — the current module only exports `initLanguageDetection`.

- [ ] **Step 10: Extract the decision logic and make it three-way**

Rewrite `src/utils/language-detector.ts`. The pure `resolveRedirectTarget` is what the tests cover; `initLanguageDetection` becomes a thin browser wrapper around it.

```ts
/**
 * Browser language detection and auto-redirect for Flightbook.
 * The decision logic is pure so it can be tested without a DOM.
 */

import type { Locale } from '~/utils/i18n';

const LOCALES: Locale[] = ['de', 'fr', 'en'];

interface DetectionInput {
  path: string;
  hash: string;
  langParam: string | null;
  isFirstVisit: boolean;
  storedLang: string | null;
  browserLang: string;
}

function pathForLocale(locale: Locale, hash: string): string {
  return locale === 'de' ? `/${hash}` : `/${locale}${hash}`;
}

function localeOfPath(path: string): Locale {
  const segment = path.split('/')[1];
  return segment === 'fr' || segment === 'en' ? segment : 'de';
}

function isLocale(value: string | null): value is Locale {
  return value !== null && (LOCALES as string[]).includes(value);
}

/** Returns the path to redirect to, or null to stay put. */
export function resolveRedirectTarget(input: DetectionInput): string | null {
  const { path, hash, langParam, isFirstVisit, storedLang, browserLang } = input;
  const current = localeOfPath(path);

  // Legacy ?lang= wins over everything.
  if (isLocale(langParam) && langParam !== current) {
    return pathForLocale(langParam, hash);
  }

  // Auto-detect only on a first visit to the root, never on a deep link.
  if (isFirstVisit && path === '/') {
    const detected = LOCALES.find((l) => browserLang.toLowerCase().startsWith(l));
    return detected && detected !== 'de' ? pathForLocale(detected, hash) : null;
  }

  // Return visits honour the stored preference.
  if (!isFirstVisit && isLocale(storedLang) && storedLang !== current) {
    return pathForLocale(storedLang, hash);
  }

  return null;
}

export function initLanguageDetection() {
  if (typeof window === 'undefined') return;

  try {
    const isFirstVisit = !localStorage.getItem('flightbook-visited');
    if (isFirstVisit) {
      localStorage.setItem('flightbook-visited', 'true');
    }

    const target = resolveRedirectTarget({
      path: window.location.pathname,
      hash: window.location.hash,
      langParam: new URLSearchParams(window.location.search).get('lang'),
      isFirstVisit,
      storedLang: localStorage.getItem('flightbook-lang'),
      browserLang: navigator.language || 'de',
    });

    if (target) {
      window.location.href = target;
    }
  } catch (e) {
    console.warn('Language detection error:', e);
  }
}
```

- [ ] **Step 11: Run all tests to verify they pass**

Run: `npm test`
Expected: PASS, 14 tests across two files.

- [ ] **Step 12: Thread the real locale into `<html lang>` and StructuredData**

In `src/components/common/StructuredData.astro`, widen the type on lines 3 and 6:

```astro
locale?: 'de' | 'fr' | 'en';
```
```astro
const { locale = 'de' } = Astro.props;
```

The existing `locale === 'de' ? … : …` ternaries on lines 25 and 35 already fall through to the non-German branch for `en`; leave them until Task 4 supplies English strings.

In `src/layouts/Layout.astro`, accept a locale and stop reading the global one for per-page output. Change the props interface and the destructure:

```astro
import type { Locale } from '~/utils/i18n';

export interface Props {
  metadata?: MetaDataType;
  locale?: Locale;
}

const { metadata = {}, locale = 'de' } = Astro.props;
const { textDirection } = I18N;
```

Then line 30 becomes `<html lang={locale} dir={textDirection} class="2xl:text-[20px]">` and line 39 becomes `<StructuredData locale={locale} />`.

In `src/layouts/PageLayout.astro`, pass it down — `currentLocale` is already derived on line 17:

```astro
<Layout metadata={metadata} locale={currentLocale}>
```

- [ ] **Step 13: Verify the build emits the right lang per route**

Run: `npm run fix && npm run build && npm run check`
Then: `grep -o 'lang="[a-z]*"' dist/index.html dist/fr/index.html`
Expected: `dist/index.html:lang="de"` and `dist/fr/index.html:lang="fr"`. (`/en` does not exist until Task 13.)

- [ ] **Step 14: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/utils src/content/i18n/en.json src/layouts src/components/common/StructuredData.astro
git commit -m "feat(i18n): add English locale plumbing and fix per-page html lang"
```

---

### Task 2: Foundations — palette, fonts, dark-mode removal

**Files:**
- Modify: `src/components/CustomStyles.astro`
- Modify: `src/assets/styles/tailwind.css:9-34` (`@theme`) and `:56-70` (button utilities)
- Modify: `src/layouts/Layout.astro` (remove `ApplyColorMode`)
- Modify: `src/layouts/PageLayout.astro:27`, `src/layouts/LandingLayout.astro:29`
- Modify: `src/config.yaml`
- Modify: `package.json` (Space Grotesk)

**Interfaces:**
- Consumes: Task 1's `Locale` type (already imported in `Layout.astro`).
- Produces: Tailwind utility classes every later task uses — `bg-ink`, `bg-surface-dark`, `bg-card-dark`, `bg-surface-light`, `text-heading`, `text-body`, `text-muted-light`, `border-hairline`, `text-sky`, `text-brand`, `btn-gradient`, `btn-on-dark`, `btn-outline-light`, and `font-heading` resolving to Space Grotesk.

- [ ] **Step 1: Install Space Grotesk**

```bash
npm install @fontsource-variable/space-grotesk
```

If that package does not exist on the registry, use `npm install @fontsource/space-grotesk` instead and import the three static weights in Step 2. Do **not** add the design's Google Fonts `<link>` — it is a render-blocking third-party request and the repo self-hosts Inter already.

- [ ] **Step 2: Replace CustomStyles with a single fixed palette**

Rewrite `src/components/CustomStyles.astro` entirely. The `.dark` block goes away.

```astro
---
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
---

<style is:inline>
  :root {
    --aw-font-sans: 'Inter Variable';
    --aw-font-serif: 'Inter Variable';
    --aw-font-heading: 'Space Grotesk Variable';

    --aw-color-primary: #2f6df6;
    --aw-color-secondary: #2559d4;
    --aw-color-accent: #38bdf8;

    --aw-color-text-heading: #0b1626;
    --aw-color-text-default: #0b1626;
    --aw-color-text-muted: #4b5c6e;
    --aw-color-bg-page: #ffffff;

    ::selection {
      background-color: #bae6fd;
    }
  }
</style>
```

If you fell back to the static package in Step 1, the imports become `@fontsource/space-grotesk/500.css`, `/600.css`, `/700.css` and `--aw-font-heading: 'Space Grotesk'`.

- [ ] **Step 3: Add the design tokens to the Tailwind theme**

In `src/assets/styles/tailwind.css`, extend the existing `@theme` block (after line 14, keeping the existing `--color-*` and `--font-*` entries):

```css
  --color-ink: #05101d;
  --color-surface-dark: #0a1626;
  --color-card-dark: #0d1b2d;
  --color-surface-light: #f5f8fc;
  --color-heading: #0b1626;
  --color-body: #4b5c6e;
  --color-muted-light: #7b8ea3;
  --color-hairline: #e4ebf3;
  --color-hairline-strong: #cbd8e6;
  --color-sky: #38bdf8;
  --color-sky-soft: #7dd3fc;
  --color-sky-pale: #bae6fd;
  --color-brand: #2f6df6;
```

Then add the animation the hero needs, inside the same `@theme` block alongside the existing `fadeInUp` keyframes:

```css
  --animate-float: floatY 7s ease-in-out infinite;

  @keyframes floatY {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-14px);
    }
  }
```

- [ ] **Step 4: Add the three button utilities the design uses**

Append to `src/assets/styles/tailwind.css`, after the existing `btn-tertiary` utility (line 70):

```css
@utility btn-gradient {
  @apply inline-flex items-center justify-center rounded-full border-0 px-7 py-3.5 text-base font-semibold text-white transition;
  background-image: linear-gradient(120deg, #38bdf8, #2f6df6);
  box-shadow: 0 10px 24px -12px rgb(56 189 248 / 0.9);
}
@utility btn-gradient-hover {
  filter: brightness(1.08);
}

@utility btn-on-dark {
  @apply inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-7 py-3.5 text-base font-semibold text-white transition hover:bg-white/20;
}

@utility btn-outline-light {
  @apply inline-flex items-center justify-center rounded-full border border-hairline-strong px-6 py-3.5 text-[15px] font-semibold text-heading transition hover:border-brand hover:text-brand;
}
```

Apply the hover on `btn-gradient` usages with `hover:brightness-110` rather than the second utility if Tailwind rejects a bare `filter` in `@utility`; both are acceptable.

- [ ] **Step 5: Remove the dark-mode machinery**

In `src/layouts/Layout.astro`, delete the `ApplyColorMode` import (line 9) and its element (line 35). This is the component that writes the `.dark` class; removing only CSS would leave it active.

In `src/layouts/PageLayout.astro` line 27 and `src/layouts/LandingLayout.astro` line 29, delete the `showToggleTheme` attribute. `Header.astro` never declared it, so nothing visible changes.

In `src/config.yaml`, under `ui:`, set:

```yaml
ui:
  theme: 'light:only'
```

And add English under `i18n.languages`:

```yaml
    en:
      name: English
      locale: en-GB
```

- [ ] **Step 6: Verify the build is clean and no dark class ships**

Run: `npm run fix && npm run build && npm run check`
Then: `grep -rc 'class="dark' dist/index.html || echo "no dark class — good"`
Expected: build and check both pass; no `.dark` class in the output.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/components/CustomStyles.astro src/assets/styles/tailwind.css src/layouts src/config.yaml
git commit -m "feat(ui): install redesign palette and Space Grotesk, remove dark mode"
```

---

### Task 3: Shared primitives — PhoneFrame and ImageCarousel

`ImageCarousel` fixes a real bug: `FlightbookPremiumFeatures.astro` currently binds with page-global selectors (`document.querySelector('.slide-nav.prev')`), and the redesign puts three carousels on one page, so the wrong slider would respond.

**Files:**
- Create: `src/components/ui/PhoneFrame.astro`
- Create: `src/components/ui/ImageCarousel.astro`

**Interfaces:**
- Consumes: Task 2's tokens.
- Produces:
  - `PhoneFrame.astro` — props `{ radius?: 'lg' | 'md' | 'sm'; class?: string; float?: boolean }`, renders a default slot inside the bezel.
  - `ImageCarousel.astro` — props `{ images: { src: ImageMetadata; alt: string; caption?: string }[]; theme?: 'dark' | 'light'; showCaption?: boolean; autoAdvanceMs?: number; class?: string }`.

- [ ] **Step 1: Create PhoneFrame**

Create `src/components/ui/PhoneFrame.astro`:

```astro
---
interface Props {
  radius?: 'lg' | 'md' | 'sm';
  float?: boolean;
  class?: string;
}

const { radius = 'md', float = false, class: className = '' } = Astro.props;

// Outer bezel radius / inner screen radius, from the design.
const radii = {
  lg: ['rounded-[44px]', 'rounded-[34px]'],
  md: ['rounded-[42px]', 'rounded-[32px]'],
  sm: ['rounded-[36px]', 'rounded-[27px]'],
}[radius];
---

<div
  class:list={[
    'border border-white/15 bg-gradient-to-br from-[#1c2b3f] to-[#08131f] p-[11px]',
    'shadow-[0_50px_90px_-30px_rgba(0,0,0,0.85)]',
    radii[0],
    float && 'motion-safe:animate-float',
    className,
  ]}
>
  <div class:list={['overflow-hidden bg-white', radii[1]]}>
    <slot />
  </div>
</div>
```

- [ ] **Step 2: Create ImageCarousel with root-scoped JavaScript**

Create `src/components/ui/ImageCarousel.astro`. Every query is scoped to `root`, so multiple instances coexist.

```astro
---
import { Image } from 'astro:assets';

interface Slide {
  src: ImageMetadata;
  alt: string;
  caption?: string;
}

interface Props {
  images: Slide[];
  theme?: 'dark' | 'light';
  showCaption?: boolean;
  autoAdvanceMs?: number;
  class?: string;
}

const { images, theme = 'dark', showCaption = false, autoAdvanceMs = 5000, class: className = '' } = Astro.props;

const arrow =
  theme === 'dark'
    ? 'h-[42px] w-[42px] rounded-full border border-white/20 bg-white/5 text-white transition hover:bg-white/15'
    : 'h-10 w-10 rounded-full border border-hairline-strong bg-white text-body transition hover:border-brand hover:text-brand';
const dotOn = theme === 'dark' ? 'bg-sky' : 'bg-brand';
const captionClass = theme === 'dark' ? 'text-white/50' : 'text-muted-light';
---

<div class:list={['flex flex-col items-center gap-5', className]} data-carousel data-interval={autoAdvanceMs}>
  <div class="w-full">
    {
      images.map((img, i) => (
        <div data-slide class:list={[i === 0 ? 'block' : 'hidden']}>
          <Image src={img.src} alt={img.alt} class="block w-full" loading="lazy" widths={[300, 600]} sizes="(max-width: 768px) 300px, 600px" />
        </div>
      ))
    }
  </div>

  <div class="flex items-center gap-3.5">
    <button type="button" data-prev class={arrow} aria-label="Previous slide">&#10094;</button>
    <div class="flex gap-[7px]">
      {
        images.map((_, i) => (
          <button
            type="button"
            data-dot
            data-index={i}
            aria-label={`Go to slide ${i + 1}`}
            class:list={['block h-[7px] w-[7px] rounded-full transition', i === 0 ? dotOn : 'bg-slate-400/45']}
          />
        ))
      }
    </div>
    <button type="button" data-next class={arrow} aria-label="Next slide">&#10095;</button>
  </div>

  {showCaption && <p class:list={['text-center text-[13px]', captionClass]} data-caption>{images[0].caption}</p>}
</div>

<script>
  function initCarousels() {
    document.querySelectorAll<HTMLElement>('[data-carousel]').forEach((root) => {
      if (root.dataset.carouselReady === 'true') return;
      root.dataset.carouselReady = 'true';

      const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-slide]'));
      const dots = Array.from(root.querySelectorAll<HTMLElement>('[data-dot]'));
      const caption = root.querySelector<HTMLElement>('[data-caption]');
      const captions = slides.map((_, i) => dots[i]?.getAttribute('data-caption') ?? '');
      if (slides.length < 2) return;

      const activeDot = dots[0]?.className.match(/bg-(sky|brand)/)?.[0] ?? 'bg-sky';
      let current = 0;
      let timer: number | undefined;

      function show(next: number) {
        current = (next + slides.length) % slides.length;
        slides.forEach((s, i) => s.classList.toggle('hidden', i !== current));
        dots.forEach((d, i) => {
          d.classList.toggle(activeDot, i === current);
          d.classList.toggle('bg-slate-400/45', i !== current);
        });
        if (caption && captions[current]) caption.textContent = captions[current];
      }

      function start() {
        const ms = Number(root.dataset.interval ?? 5000);
        if (ms > 0) timer = window.setInterval(() => show(current + 1), ms);
      }
      function restart() {
        window.clearInterval(timer);
        start();
      }

      root.querySelector('[data-prev]')?.addEventListener('click', () => {
        show(current - 1);
        restart();
      });
      root.querySelector('[data-next]')?.addEventListener('click', () => {
        show(current + 1);
        restart();
      });
      dots.forEach((dot, i) =>
        dot.addEventListener('click', () => {
          show(i);
          restart();
        })
      );

      root.addEventListener('mouseenter', () => window.clearInterval(timer));
      root.addEventListener('mouseleave', start);
      start();
    });
  }

  initCarousels();
  document.addEventListener('astro:page-load', initCarousels);
</script>
```

Note the `astro:page-load` listener: `Layout.astro` enables `<ClientRouter />`, so view transitions replace the DOM and a bare top-level init would run only on first load. The `data-carousel-ready` guard keeps re-init idempotent.

Captions are read from the dots' `data-caption`. Add that attribute in the dot map when `showCaption` is set:

```astro
data-caption={images[i]?.caption ?? ''}
```

Place it on the `<button data-dot>` element alongside `data-index`.

The script block needs no imports — it is inline client JavaScript, not a module with Astro dependencies.

- [ ] **Step 3: Verify it compiles**

Run: `npm run fix && npm run build && npm run check`
Expected: PASS. Nothing renders the components yet, so this only proves they typecheck and format.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/PhoneFrame.astro src/components/ui/ImageCarousel.astro
git commit -m "feat(ui): add PhoneFrame and root-scoped ImageCarousel primitives"
```

---

### Task 4: Content — the three i18n tables

Every string for all three locales, lifted from the design's inline German and its `FR`/`EN` dictionaries.

**Files:**
- Modify: `src/content/i18n/de.json`
- Modify: `src/content/i18n/fr.json`
- Modify: `src/content/i18n/en.json` (replaces the Task 1 stub)

**Interfaces:**
- Consumes: nothing.
- Produces: a table shape all page and widget tasks read. Keys, in full:

```
nav.{features,pricing,schools,tandem,faq,login,loginPilot,loginPilotSub,loginSchool,loginSchoolSub,register,skipToContent}
hero.{eyebrow,titleLine1,titleLine2,subtitle,ios,android,subscribePremium}
hero.stats[4].{value,label}
features.{title,intro,cta}
features.items[8].{title,description}
features.captions[4]
pricing.{title,intro}
pricing.{free,premium,schools}.{badge,title,price,period?,features[],cta}
pricing.notes[]
schools.{title,eyebrow,cta}
schools.items[3].{title,description}
tandem.{eyebrow,title,intro,cta}
tandem.items[4].{title,description}
faq.title
faq.questions[6].{question,answer,steps?}
footer.{ctaTitle,ctaButton,openSource,github,legal,privacy}
meta.{title,description,ogTitle,ogDescription}
```

- [ ] **Step 1: Restructure the German table**

Rewrite `src/content/i18n/de.json` to the shape above. Source of truth is the design file's inline German. Notes:

- `features.items` has **eight** entries in this order: Flüge erfassen, Tracks visualisieren, Statistiken analysieren, **Daten exportieren**, Daten importieren, Tracks auf der Karte lesen, Start- und Landeplätze, Schirme im Überblick.
- **Correction applied:** the design's fourth card is titled "Fortschritt tracken" but its body is about Excel and PDF export. Title it `"Daten exportieren"`.
- `features.captions` are the four carousel captions: `"Startseite - Übersicht der Flugverwaltung"`, `"Statistiken - Auswertung von Flugdaten"`, `"Flug hinzufügen - Neue Flüge erfassen"`, `"Flugplätze verwalten - Start- und Landeplätze"`.
- `schools.items[2].title` is **`"Fortschritt tracken für Flugschüler"`** — the design's `tracklen` is a typo.
- `faq.questions[5]` carries `"steps": ["Erstelle deine Flugschule", "Füge deine Schüler hinzu", "Lege los!"]`. The other five omit `steps`. This replaces the current embedded-HTML `<ol>` in the answer string, so `FlightbookFAQ` no longer needs `set:html` for list markup.
- `pricing.notes` keeps all three existing notes.
- `hero.stats` are the four pairs from the design: SHV zugelassen / an der Prüfung anerkannt; Flüge erfassen / Flugbuch verwalten; Fortschritt tracken / für angehende Pilot\*innen; Höhenflüge organisieren / für Flugschulen.

- [ ] **Step 2: Rewrite the French table from the design's FR dictionary**

Rewrite `src/content/i18n/fr.json` to the identical shape. Every French string exists in the design's `FR` map — translate key-by-key from the German you just wrote by looking up the German source string in that map. `schools` stays `"Schools"` and `Tandem` stays `"Tandem"` per the design (both are untranslated brand terms there).

For `faq.questions[5].steps`: `["Crée ton école de vol", "Ajoute tes élèves", "C'est parti !"]`.

- [ ] **Step 3: Write the English table from the design's EN dictionary**

Replace `src/content/i18n/en.json` (currently the Task 1 stub) with the same shape, sourced from the design's `EN` map. `nav.register` must remain `"Sign up"` so Task 1's test still passes.

For `faq.questions[5].steps`: `["Create your flight school", "Add your students", "Off you go!"]`.

English `meta` strings are not in the design. Write them from the German, matching its structure: title `"Paragliding Logbook - SHV approved | Flightbook"`, description `"Digital paragliding logbook for iOS and Android - SHV approved. Manage your flights, gliders and statistics. For pilots, tandem and flight schools. Start for free!"`, and `ogTitle`/`ogDescription` matching the German pattern (og description drops the final call to action).

- [ ] **Step 4: Verify all three tables are structurally identical**

Run:

```bash
node -e "
const a=require('./src/content/i18n/de.json'),b=require('./src/content/i18n/fr.json'),c=require('./src/content/i18n/en.json');
const shape=o=>JSON.stringify(Object.entries(o).map(([k,v])=>[k,v&&typeof v==='object'?(Array.isArray(v)?['[]',v.length,v[0]&&typeof v[0]==='object'?shape(v[0]):'s']:shape(v)):'s']));
for (const [n,o] of [['fr',b],['en',c]]) console.log(n, shape(a)===shape(o) ? 'OK' : 'MISMATCH');
"
```

Expected: `fr OK` and `en OK`. If either mismatches, the differing key is a missing or extra entry — fix before moving on, because every later task indexes these arrays positionally.

- [ ] **Step 5: Run the locale tests and the build**

Run: `npm test && npm run fix && npm run build && npm run check`
Expected: PASS. With `en.json` now full, the union-type note from Task 1 Step 6 resolves.

- [ ] **Step 6: Commit**

```bash
git add src/content/i18n
git commit -m "feat(i18n): full DE/FR/EN copy tables for the redesign"
```

---

### Task 5: Header, language pill, navigation data

**Files:**
- Modify: `src/navigation.ts`
- Modify: `src/components/widgets/Header.astro`
- Modify: `src/components/common/LanguageSwitcher.astro`
- Modify: `src/layouts/PageLayout.astro:18-19`

**Interfaces:**
- Consumes: Task 1's `Locale`, Task 2's tokens, Task 4's `nav.*` keys.
- Produces:
  - `getHeaderData(locale: Locale)` and `getFooterData(locale: Locale)` from `~/navigation`, replacing the six exported constants.
  - `LanguageSwitcher.astro` props `{ currentLocale: Locale }`.

- [ ] **Step 1: Replace the navigation constants with locale-driven builders**

Rewrite `src/navigation.ts`. The six hand-maintained constants become two functions reading Task 4's tables, so adding a locale no longer means editing this file.

```ts
import { getTranslations, type Locale } from '~/utils/i18n';

const prefix = (locale: Locale) => (locale === 'de' ? '' : `/${locale}`);

export function getHeaderData(locale: Locale) {
  const t = getTranslations(locale);
  const p = prefix(locale);

  return {
    links: [
      { text: t.nav.features, href: `${p}/#premium` },
      { text: t.nav.pricing, href: `${p}/#angebot` },
      { text: t.nav.schools, href: `${p}/#schools` },
      { text: t.nav.tandem, href: `${p}/#tandem` },
      { text: t.nav.faq, href: `${p}/#faq` },
    ],
    login: {
      text: t.nav.login,
      links: [
        { text: t.nav.loginPilot, sub: t.nav.loginPilotSub, href: 'https://m.flightbook.ch', icon: 'wing' as const },
        { text: t.nav.loginSchool, sub: t.nav.loginSchoolSub, href: 'https://instructor.flightbook.ch', icon: 'cap' as const },
      ],
    },
    action: { text: t.nav.register, href: 'https://m.flightbook.ch/register' },
  };
}

export function getFooterData(locale: Locale) {
  const t = getTranslations(locale);
  const p = prefix(locale);

  return {
    cta: { title: t.footer.ctaTitle, button: t.footer.ctaButton, href: 'https://m.flightbook.ch/register' },
    columns: [
      { title: t.footer.openSource, links: [{ text: t.footer.github, href: 'https://github.com/vast-ch/flightbook' }] },
      { title: t.footer.legal, links: [{ text: t.footer.privacy, href: `${p}/privacy-policy` }] },
    ],
  };
}
```

- [ ] **Step 2: Rebuild the language switcher as a three-way pill**

Rewrite `src/components/common/LanguageSwitcher.astro`. It now derives the sibling path for each of the three locales rather than toggling between two.

```astro
---
import type { Locale } from '~/utils/i18n';

interface Props {
  currentLocale: Locale;
}

const { currentLocale } = Astro.props;
const LOCALES: Locale[] = ['de', 'fr', 'en'];

// Strip any locale prefix, then re-prefix for each target.
const bare = Astro.url.pathname.replace(/^\/(fr|en)(?=\/|$)/, '') || '/';
const hrefFor = (l: Locale) => (l === 'de' ? bare : `/${l}${bare === '/' ? '' : bare}`);
---

<div class="flex items-center gap-0.5 rounded-full border border-white/15 bg-white/5 p-[3px]">
  {
    LOCALES.map((l) => (
      <a
        href={hrefFor(l)}
        data-lang={l}
        aria-label={`Switch to ${l.toUpperCase()}`}
        aria-current={l === currentLocale ? 'true' : undefined}
        class:list={[
          'lang-btn rounded-full px-3 py-1.5 text-[12.5px] font-semibold tracking-[0.06em] transition',
          l === currentLocale ? 'bg-white text-ink' : 'text-white/65 hover:text-white',
        ]}
      >
        {l.toUpperCase()}
      </a>
    ))
  }
</div>

<script>
  function bindLangButtons() {
    document.querySelectorAll<HTMLElement>('.lang-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        if (!lang) return;
        try {
          localStorage.setItem('flightbook-lang', lang);
        } catch (e) {
          console.warn('Could not store language preference:', e);
        }
      });
    });
  }
  bindLangButtons();
  document.addEventListener('astro:page-load', bindLangButtons);
</script>
```

- [ ] **Step 3: Rewrite the header**

Rewrite `src/components/widgets/Header.astro` as the design's dark glass bar. It takes the whole object from `getHeaderData` rather than spread props.

Structure, in order inside a `max-w-[1240px]` centred row with `px-7 py-3.5`:

1. Logo link to `#top` — `<img src="/flightbook-icon.png">` at `h-[34px] w-[34px] rounded-[10px]`, then the wordmark in `font-heading text-[19px] font-bold tracking-[-0.02em] text-white`.
2. `<nav>` with the five anchors at `text-[14.5px] font-medium text-white/70 hover:text-white`.
3. `<LanguageSwitcher currentLocale={locale} />`.
4. The Login dropdown.
5. The Registrieren button using `btn-gradient` at the smaller `px-5 py-2.5 text-[14.5px]` size.

The header element itself:

```astro
<header
  class="sticky top-0 z-60 w-full border-b border-white/10 bg-[rgba(5,16,29,0.72)] backdrop-blur-[14px] backdrop-saturate-150"
  id="header"
>
```

The dropdown uses the existing CSS-only pattern — `tailwind.css` already ships `.dropdown:hover .dropdown-menu` and `:focus-within`. Add `tabindex="0"` to the trigger so keyboard users reach it:

```astro
<div class="dropdown relative">
  <button
    type="button"
    class="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/5 px-4.5 py-2.5 text-[14.5px] font-semibold text-white transition hover:bg-white/15"
  >
    <span>{data.login.text}</span>
    <span class="text-[10px] opacity-70">▾</span>
  </button>
  <ul
    class="dropdown-menu absolute right-0 top-[calc(100%+10px)] hidden w-[268px] rounded-2xl border border-white/15 bg-card-dark p-2 shadow-[0_26px_50px_-22px_rgba(0,0,0,0.8)]"
  >
    {
      data.login.links.map((item) => (
        <li>
          <a href={item.href} class="flex items-center gap-3 rounded-[11px] px-3.5 py-3 text-white hover:bg-white/10">
            <span class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-sky/15">
              <!-- 18x18 stroke icon, stroke="#7dd3fc" stroke-width="1.9" -->
            </span>
            <span class="flex flex-col gap-0.5">
              <span class="text-[14.5px] font-semibold">{item.text}</span>
              <span class="text-[12.5px] text-white/55">{item.sub}</span>
            </span>
          </a>
        </li>
      ))
    }
  </ul>
</div>
```

Copy the two inline SVG paths verbatim from the design file's login dropdown: the wing glyph (`M12 4c-4.4 0-8 3.2-8 7.2L12 20l8-8.8C20 7.2 16.4 4 12 4Z` plus its two strokes) for Flightbook, and the graduation cap (`M3 9.5 12 5l9 4.5-9 4.5-9-4.5Z` plus the band path) for Schools.

Mobile: below `md`, hide the `<nav>` and the Login dropdown, keep logo + language pill + Registrieren, and reuse the existing `ToggleMenu` component with the nav collapsing into the `#header.expanded nav` fixed panel that `tailwind.css` already styles.

- [ ] **Step 4: Point PageLayout at the new builders**

In `src/layouts/PageLayout.astro`, replace lines 18-19 and the header/footer calls:

```astro
import { getHeaderData, getFooterData } from '~/navigation';

const headerData = getHeaderData(currentLocale);
const footerNavData = getFooterData(currentLocale);
```
```astro
<Header data={headerData} locale={currentLocale} />
```

Footer still receives `{...footerNavData}` until Task 12 rewrites it; adapt the spread to the new shape there.

- [ ] **Step 5: Verify**

Run: `npm run fix && npm run build && npm run check`
Then open `npm run preview` and confirm: the bar is dark and translucent over the page, the Login dropdown opens on hover **and** on keyboard focus, and DE/FR/EN each navigate to the right path preserving the sub-path.

- [ ] **Step 6: Commit**

```bash
git add src/navigation.ts src/components/widgets/Header.astro src/components/common/LanguageSwitcher.astro src/layouts/PageLayout.astro
git commit -m "feat(header): dark glass header with login dropdown and DE/FR/EN pill"
```

---

### Task 6: Hero

**Files:**
- Modify: `src/components/widgets/FlightbookHero.astro`

**Interfaces:**
- Consumes: `PhoneFrame` (Task 3), tokens (Task 2), `hero.*` (Task 4).
- Produces: props `{ eyebrow, titleLine1, titleLine2, subtitle, ios, android, premium, stats: {value,label}[], photo: ImageMetadata, screenshot: ImageMetadata }`.

- [ ] **Step 1: Rewrite the hero**

Rewrite `src/components/widgets/FlightbookHero.astro`. Section is `relative overflow-hidden bg-ink` with `id="top"`.

Layers, in order:
1. `<Image>` of `photo` absolutely positioned `inset-0 h-full w-full object-cover`, `loading="eager"`, `fetchpriority="high"`.
2. Scrim one: `absolute inset-0 pointer-events-none` with `background:linear-gradient(100deg,rgba(5,16,29,.94) 0%,rgba(5,16,29,.74) 46%,rgba(5,16,29,.42) 100%)`.
3. Scrim two: same positioning with `background:linear-gradient(180deg,rgba(5,16,29,.35) 0%,transparent 35%,rgba(5,16,29,.75) 100%)`.
4. Content grid: `relative mx-auto max-w-[1240px] px-7 py-[104px] pt-[120px] grid gap-14 items-center lg:grid-cols-[1.05fr_.95fr]`.

Left column (`flex flex-col items-start gap-7`):
- Eyebrow pill: `rounded-full border border-sky/45 bg-sky/10 px-4 py-1.5 text-[13px] font-semibold text-sky-pale`.
- Headline: `font-heading text-white leading-[0.94] tracking-[-0.045em] text-4xl sm:text-6xl lg:text-[88px]` — the responsive ramp is ours, the design only specifies 88px. Second line gets `bg-gradient-to-r from-sky-soft to-brand bg-clip-text text-transparent`.
- Subtitle: `max-w-[520px] text-xl leading-relaxed text-white/75 text-pretty`.
- CTA row `flex flex-wrap gap-3 pt-1`: iOS as `rounded-full bg-white px-7 py-3.5 text-base font-semibold text-ink hover:bg-sky-pale`; Android as `btn-on-dark`; the premium link as `self-center pl-2 text-[15.5px] font-semibold text-sky-soft`. Keep the existing App Store and Play Store hrefs and `target="_blank" rel="noopener"`.

Right column: centred, with a `h-[340px] w-[340px] rounded-full` radial glow behind (`radial-gradient(circle,rgba(56,189,248,.42),transparent 65%)`, `blur-[12px]`), then `<PhoneFrame radius="lg" float class="relative w-72">` wrapping the `screenshot` image.

Stat strip, after the grid, inside `relative border-t border-white/10`: `mx-auto max-w-[1240px] px-7 py-6 grid gap-6 grid-cols-2 lg:grid-cols-4`, each cell `flex flex-col gap-1` with value in `font-heading text-[21px] leading-tight text-white` and label in `text-[13px] uppercase tracking-[0.12em] text-white/50`.

Delete the old `md:-mt-[76px]` offset — the new header is sticky and translucent, so the hero starts below it naturally.

- [ ] **Step 2: Wire it up temporarily to verify**

The pages are rewritten in Task 13. To check this task in isolation, temporarily pass the props in `src/pages/index.astro`, using `hero-image.png` for `photo` and `home.png` for `screenshot`.

- [ ] **Step 3: Verify**

Run: `npm run fix && npm run build && npm run check`
Then `npm run preview` and confirm at 1440px, 768px and 375px: the headline never overflows, the phone does not overlap the text column, and the stat strip reflows 4 → 2 columns.

- [ ] **Step 4: Commit**

```bash
git add src/components/widgets/FlightbookHero.astro src/pages/index.astro
git commit -m "feat(hero): photo-led hero with phone mockup and stat strip"
```

---

### Task 7: Funktionalitäten — eight-card grid with sticky carousel

**Files:**
- Modify: `src/components/widgets/FlightbookPremiumFeatures.astro`

**Interfaces:**
- Consumes: `PhoneFrame`, `ImageCarousel`, `features.*`.
- Produces: props `{ title, intro, cta, items: {title,description}[], screenshots: {src,alt,caption}[] }`.

- [ ] **Step 1: Rewrite the section**

Section: `id="premium" class="scroll-mt-16 bg-surface-dark px-7 py-28"`.

Inner: `mx-auto flex max-w-[1240px] flex-col gap-14`.

Head row: `flex flex-wrap items-end justify-between gap-10` — `<h2>` at `font-heading text-4xl lg:text-[52px] text-white max-w-[620px]`, intro paragraph at `max-w-[400px] text-[17px] leading-relaxed text-white/60 text-pretty`.

Body: `grid gap-[72px] items-start lg:grid-cols-[1fr_340px]`.

The card grid is a hairline grid — the 2px gap on a light background is what draws the dividers:

```astro
<div class="grid grid-cols-1 gap-[2px] overflow-hidden rounded-[22px] border border-white/10 bg-white/10 sm:grid-cols-2">
  {
    items.map((item) => (
      <div class="flex flex-col gap-3 bg-card-dark p-8">
        <h3 class="font-heading text-[21px] text-white">{item.title}</h3>
        <p class="text-[15px] leading-[1.7] text-white/60 text-pretty">{item.description}</p>
      </div>
    ))
  }
  <div class="bg-card-dark px-8 py-7 sm:col-span-2">
    <a href="https://m.flightbook.ch/register" target="_blank" rel="noopener" class="btn-gradient">{cta}</a>
  </div>
</div>
```

Aside: `<div class="sticky top-24 flex flex-col items-center gap-5">` containing `<PhoneFrame radius="md" class="w-full">` around `<ImageCarousel images={screenshots} theme="dark" showCaption />`.

Note the carousel sits *outside* the phone's screen slot for its controls but the images sit inside — render `PhoneFrame` around only the image area, then the controls below it, matching the design. Simplest structure: `ImageCarousel` renders the images; wrap the whole carousel in the aside and give `PhoneFrame` the carousel's image container via its slot only if the visual matches. If wrapping proves awkward, render the four images inside `PhoneFrame` and keep `ImageCarousel`'s controls as siblings — the design shows the frame around the screen and the arrows beneath it.

Delete the old `icons` array and the four inline SVG paths — the redesign has no per-feature icons.

- [ ] **Step 2: Verify**

Run: `npm run fix && npm run build && npm run check`
Then `npm run preview`: confirm the grid is 2-up on desktop and 1-up under `sm`, the CTA cell spans both columns, the aside sticks while the grid scrolls, and the caption changes with the slide.

- [ ] **Step 3: Commit**

```bash
git add src/components/widgets/FlightbookPremiumFeatures.astro
git commit -m "feat(features): eight-card hairline grid with sticky phone carousel"
```

---

### Task 8: Pricing

**Files:**
- Modify: `src/components/widgets/FlightbookPricing.astro`

**Interfaces:**
- Consumes: tokens, `pricing.*`.
- Produces: props `{ title, intro, plans: PricingPlan[], notes: string[] }` where `PricingPlan` keeps its current fields plus `featured`.

- [ ] **Step 1: Rewrite the section**

Section: `id="angebot" class="scroll-mt-16 bg-surface-light px-7 py-28"`. Inner `mx-auto flex max-w-[1240px] flex-col gap-12`.

Head: centred `flex flex-col items-center gap-3.5 text-center` — `<h2 class="font-heading text-4xl lg:text-[52px] text-heading">`, intro `text-base text-[#5a6b7d]`.

Cards: `grid items-start gap-5 md:grid-cols-3`.

Standard card: `flex min-h-[460px] flex-col gap-4.5 rounded-3xl border border-hairline bg-white p-8`. Badge `text-xs font-bold uppercase tracking-[0.14em] text-muted-light`. Title `font-heading text-[26px]`. Price `font-heading text-[38px] font-bold tracking-[-0.03em]`. Feature list `flex flex-1 flex-col gap-3`, each `flex gap-3 text-[15px] text-body` with a `text-brand` check glyph. CTA `btn-outline-light text-center`.

Featured card: `relative min-h-[500px] overflow-hidden rounded-3xl p-8 shadow-[0_40px_70px_-34px_rgba(11,22,38,0.6)]` with `background:linear-gradient(165deg,#0d1b2d,#122c4d)`, plus an absolutely-positioned glow `-top-15 -right-10 h-[220px] w-[220px] rounded-full` with `radial-gradient(circle,rgba(56,189,248,.35),transparent 65%)`. All its children need `relative` to sit above the glow. Badge `text-sky-soft`, title and price white, list items `text-white/75` with `text-sky-soft` checks, CTA `btn-gradient w-full`.

Drop the old badge-colour conditional that string-matched `plan.badge === 'Flugschule' || plan.badge === 'Instructeur'` — it breaks with a third locale and the redesign styles badges uniformly.

Notes: `mx-auto flex max-w-[760px] flex-col gap-3 text-center text-sm leading-relaxed text-muted-light`.

- [ ] **Step 2: Verify**

Run: `npm run fix && npm run build && npm run check`
Then `npm run preview` at all three widths — cards must stack cleanly under `md` with the featured card keeping its elevation.

- [ ] **Step 3: Commit**

```bash
git add src/components/widgets/FlightbookPricing.astro
git commit -m "feat(pricing): light section with elevated dark featured plan"
```

---

### Task 9: Schools

**Files:**
- Modify: `src/components/widgets/FlightbookSchoolsFeatures.astro`

**Interfaces:**
- Consumes: `ImageCarousel`, `schools.*`.
- Produces: props `{ eyebrow, title, cta, items: {title,description}[], studentImg, schoolSlides, studentSlides }`.

- [ ] **Step 1: Rewrite the section**

Section: `id="schools" class="scroll-mt-16 bg-white px-7 py-28"`. Inner `mx-auto flex max-w-[1240px] flex-col gap-20`.

Head: `flex max-w-[660px] flex-col gap-3.5` — eyebrow `text-xs font-bold uppercase tracking-[0.14em] text-brand`, `<h2 class="font-heading text-4xl lg:text-[52px]">`.

Three rows, each `grid items-center gap-14 lg:grid-cols-[1fr_1.15fr]` (row 2 reverses to `lg:grid-cols-[1.15fr_1fr]` with the figure first):

- Row 1 — text left, single `<Image>` right in a figure shell: `w-full overflow-hidden rounded-[18px] border border-hairline bg-white shadow-[0_26px_50px_-30px_rgba(11,22,38,0.55)]`.
- Row 2 — `ImageCarousel` left with `theme="light"`, text right.
- Row 3 — text left (with the `btn-outline-light`-styled CTA rendered as a dark pill: `rounded-full bg-heading px-7 py-3.5 text-base font-semibold text-white hover:bg-[#16273c]`), carousel right.

Text blocks: `<h3 class="font-heading text-[26px]">` and `<p class="max-w-[620px] text-[16.5px] leading-[1.75] text-body text-pretty">`.

Delete the entire `<style>` block and both `<script>` blocks — `ImageCarousel` replaces roughly 200 lines of duplicated slider code.

**Slide sets:** the design reuses the same three school screenshots for both carousels, which is a mock shortcut. Keep the repo's existing distinct sets: school carousel gets `subscription`, `appointment`, `appointment-create`; student carousel gets `home-mobile`, `appointment-mobile`, `appointment-detail`, `place-mobile`.

- [ ] **Step 2: Verify**

Run: `npm run fix && npm run build && npm run check`
Then `npm run preview`: confirm the two carousels operate **independently** — click next on one and the other must not move. This is the regression the shared component exists to prevent.

- [ ] **Step 3: Commit**

```bash
git add src/components/widgets/FlightbookSchoolsFeatures.astro
git commit -m "feat(schools): alternating rows on shared carousel primitive"
```

---

### Task 10: Tandem (new section)

**Files:**
- Create: `src/components/widgets/FlightbookTandem.astro`

**Interfaces:**
- Consumes: `PhoneFrame`, tokens, `tandem.*`.
- Produces: props `{ eyebrow, title, intro, cta, items: {title,description}[], photo: ImageMetadata, screenshot: ImageMetadata }`.

- [ ] **Step 1: Create the section**

Section: `id="tandem" class="scroll-mt-16 relative overflow-hidden bg-ink px-7 py-28"`.

Layers:
1. `<Image>` of `photo`, `absolute inset-0 h-full w-full object-cover opacity-50`, `loading="lazy"`.
2. Scrim: `absolute inset-0 pointer-events-none` with `background:linear-gradient(90deg,rgba(5,16,29,.96) 0%,rgba(5,16,29,.8) 55%,rgba(5,16,29,.6) 100%)`.
3. Content: `relative mx-auto grid max-w-[1240px] items-start gap-[72px] lg:grid-cols-[268px_1fr]`.

Left: `<PhoneFrame radius="sm" class="w-full">` around the `screenshot` image.

Right: `flex flex-col items-start gap-8` — eyebrow `text-xs font-bold uppercase tracking-[0.14em] text-sky-soft`, `<h2 class="font-heading text-4xl lg:text-[52px] text-white">`, intro `max-w-[660px] text-[19px] leading-relaxed text-white/70 text-pretty`, then the 2×2 sub-feature grid:

```astro
<div class="grid gap-x-11 gap-y-7 sm:grid-cols-2">
  {
    items.map((item) => (
      <div class="flex flex-col gap-2.5">
        <h3 class="font-heading text-xl text-white">{item.title}</h3>
        <p class="text-[15px] leading-[1.7] text-white/60 text-pretty">{item.description}</p>
      </div>
    ))
  }
</div>
```

Then the CTA as `btn-gradient` linking to `https://m.flightbook.ch/register` with `target="_blank" rel="noopener"`.

Under `lg`, the phone moves above the text and centres.

**Interim asset:** the passenger-confirmation screenshot does not exist in the repo. Pass `src/assets/images/flightbook/home.png` as `screenshot` for now, and `src/assets/images/hero-image.png` as `photo`. Task 13 Step 5 records both swaps as follow-ups.

- [ ] **Step 2: Verify**

Run: `npm run fix && npm run build && npm run check`
Then `npm run preview`: at 375px the phone must sit above the copy, and the 2×2 grid must collapse to one column.

- [ ] **Step 3: Commit**

```bash
git add src/components/widgets/FlightbookTandem.astro
git commit -m "feat(tandem): new tandem-pilot section"
```

---

### Task 11: FAQ

**Files:**
- Modify: `src/components/widgets/FlightbookFAQ.astro`

**Interfaces:**
- Consumes: `faq.*` including the new optional `steps: string[]`.
- Produces: props `{ title, faqs: {question,answer,steps?}[], locale }`.

- [ ] **Step 1: Rewrite the accordion**

Section: `id="faq" class="scroll-mt-16 bg-surface-light px-7 py-28"`. Inner `mx-auto flex max-w-[860px] flex-col gap-10`. Heading centred, `font-heading text-4xl lg:text-[52px]`.

Keep `<details>`/`<summary>` rather than the design's JavaScript toggle — it is keyboard accessible and works without JS. Use `name="faq"` on every `<details>` to get the design's single-open behaviour natively.

```astro
<div class="flex flex-col gap-3">
  {
    faqs.map((faq) => (
      <details name="faq" class="group overflow-hidden rounded-[18px] border border-hairline bg-white">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5.5 hover:bg-[#fafcff]">
          <h3 class="text-[17.5px] font-semibold text-heading">{faq.question}</h3>
          <span class="text-[22px] leading-none text-brand">
            <span class="group-open:hidden">+</span>
            <span class="hidden group-open:inline">−</span>
          </span>
        </summary>
        <div class="flex flex-col gap-3 px-6 pb-6">
          <p class="text-[15.5px] leading-[1.75] text-body text-pretty">{faq.answer}</p>
          {faq.steps && (
            <>
              <ol class="flex flex-col gap-2 text-[15.5px] text-body">
                {faq.steps.map((step, i) => (
                  <li class="flex gap-2.5">
                    <span class="font-bold text-brand">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              <a href="https://instructor.flightbook.ch/school/register" target="_blank" rel="noopener" class="text-[15px] font-semibold text-brand">
                {schoolCtaLabel}
              </a>
            </>
          )}
        </div>
      </details>
    ))
  }
</div>
```

`schoolCtaLabel` comes from `schools.cta` in the locale table — pass it as a prop.

Keep the `FAQPage` JSON-LD block, but simplify `stripHtml`: answers are now plain text, so the schema's `text` becomes `faq.answer` plus, when present, the steps joined with `'. '`. Drop the regex helper.

Note: `<details name>` (exclusive accordion) is supported in all current evergreen browsers; where unsupported it degrades to multiple-open, which is acceptable.

- [ ] **Step 2: Verify**

Run: `npm run fix && npm run build && npm run check`
Then `npm run preview`: opening one entry closes the others, `+` flips to `−`, and the last question shows its three numbered steps plus the school link.
Also confirm the JSON-LD still parses: `node -e "const m=require('fs').readFileSync('dist/index.html','utf8').match(/<script type=\"application\/ld\+json\">(.*?)<\/script>/s); JSON.parse(m[1]); console.log('ld+json OK')"`

- [ ] **Step 3: Commit**

```bash
git add src/components/widgets/FlightbookFAQ.astro
git commit -m "feat(faq): plus/minus accordion with structured steps"
```

---

### Task 12: Footer

**Files:**
- Modify: `src/components/widgets/Footer.astro`

**Interfaces:**
- Consumes: Task 5's `getFooterData` shape `{ cta, columns }`.
- Produces: props `{ cta: {title,button,href}, columns: {title, links: {text,href}[]}[] }`.

- [ ] **Step 1: Rewrite the footer**

Footer: `bg-ink px-7 pb-11 pt-18 text-white/70`. Inner `mx-auto flex max-w-[1240px] flex-col gap-12`.

CTA band first:

```astro
<div
  class="flex flex-wrap items-center justify-between gap-8 rounded-[26px] border border-white/12 px-10 py-9"
  style="background:linear-gradient(120deg,rgba(56,189,248,.14),rgba(47,109,246,.06))"
>
  <h3 class="font-heading max-w-[520px] text-[32px] text-white">{cta.title}</h3>
  <a href={cta.href} target="_blank" rel="noopener" class="rounded-full bg-white px-7 py-3.5 text-base font-semibold text-ink transition hover:bg-sky-pale">
    {cta.button}
  </a>
</div>
```

Then the link row: `flex flex-wrap items-start justify-between gap-10 border-t border-white/10 pt-8` — logo block on the left (icon at `h-[30px] w-[30px] rounded-[9px]` plus `font-heading text-[17px] font-bold text-white`), and `flex flex-wrap gap-14` of columns on the right. Column titles `text-xs font-bold uppercase tracking-[0.14em] text-white/45`, links `text-[15px] text-white/75 hover:text-white`.

Drop the `intersect-once`/`motion-safe:md:opacity-0` animation wrapper and the `socialLinks`/`secondaryLinks`/`footNote` props — all three are empty in this project and the redesign has no slot for them.

- [ ] **Step 2: Verify**

Run: `npm run fix && npm run build && npm run check`
Then `npm run preview` and confirm the CTA band wraps rather than overflowing at 375px.

- [ ] **Step 3: Commit**

```bash
git add src/components/widgets/Footer.astro
git commit -m "feat(footer): gradient CTA band above link columns"
```

---

### Task 13: Page composition, English routes, final verification

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/pages/fr/index.astro`
- Create: `src/pages/en/index.astro`
- Create: `src/pages/en/privacy-policy.astro`
- Create: `src/pages/en/help.astro`

**Interfaces:**
- Consumes: every widget from Tasks 6-12 and every table key from Task 4.
- Produces: the finished site.

- [ ] **Step 1: Extract the shared page body**

All three index pages differ only by locale. Rather than triplicating ~90 lines, create `src/components/FlightbookHome.astro` taking a single `locale: Locale` prop, resolving `const t = getTranslations(locale)` and rendering the six sections in order with the images imported once:

```astro
---
import { getTranslations, type Locale } from '~/utils/i18n';
import FlightbookHero from '~/components/widgets/FlightbookHero.astro';
import FlightbookPremiumFeatures from '~/components/widgets/FlightbookPremiumFeatures.astro';
import FlightbookPricing from '~/components/widgets/FlightbookPricing.astro';
import FlightbookSchoolsFeatures from '~/components/widgets/FlightbookSchoolsFeatures.astro';
import FlightbookTandem from '~/components/widgets/FlightbookTandem.astro';
import FlightbookFAQ from '~/components/widgets/FlightbookFAQ.astro';

import heroPhoto from '~/assets/images/hero-image.png';
import homeImg from '~/assets/images/flightbook/home.png';
import statisticImg from '~/assets/images/flightbook/statistic.png';
import addFlightImg from '~/assets/images/flightbook/add-flight.png';
import placeImg from '~/assets/images/flightbook/place.png';
import studentImg from '~/assets/images/flightbook/student.png';
import subscriptionImg from '~/assets/images/flightbook/subscription.png';
import appointmentImg from '~/assets/images/flightbook/appointment.png';
import appointmentCreateImg from '~/assets/images/flightbook/appointment-create.png';
import homeMobileImg from '~/assets/images/flightbook/home-mobile.png';
import appointmentMobileImg from '~/assets/images/flightbook/appointment-mobile.png';
import appointmentDetailImg from '~/assets/images/flightbook/appointment-detail.png';
import placeMobileImg from '~/assets/images/flightbook/place-mobile.png';

interface Props {
  locale: Locale;
}

const { locale } = Astro.props;
const t = getTranslations(locale);

const featureShots = [homeImg, statisticImg, addFlightImg, placeImg].map((src, i) => ({
  src,
  alt: t.features.captions[i],
  caption: t.features.captions[i],
}));
---
```

Then render the six sections, passing `t.*` through. Build `pricingPlans` here from `t.pricing.{free,premium,schools}` exactly as `index.astro` does today, with the same three `ctaLink` URLs.

- [ ] **Step 2: Reduce the three index pages to metadata plus the shared body**

`src/pages/index.astro` becomes:

```astro
---
import Layout from '~/layouts/PageLayout.astro';
import FlightbookHome from '~/components/FlightbookHome.astro';
import { getTranslations } from '~/utils/i18n';

const t = getTranslations('de');

const metadata = {
  title: t.meta.title,
  description: t.meta.description,
  canonical: 'https://flightbook.ch',
  openGraph: {
    title: t.meta.ogTitle,
    description: t.meta.ogDescription,
    type: 'website',
    url: 'https://flightbook.ch',
    images: [
      {
        url: 'https://raw.githubusercontent.com/laggery/Flightbook-MobileApp/7d738a8497449768f4a38d647cfdf7da138f77b6/src/assets/icons/icon-128x128.png',
        width: 128,
        height: 128,
        alt: 'Flightbook App Icon',
      },
    ],
  },
  robots: { index: true, follow: true },
};
---

<Layout metadata={metadata}>
  <FlightbookHome locale="de" />
</Layout>

<script>
  import { initLanguageDetection } from '~/utils/language-detector';
  initLanguageDetection();
</script>
```

`fr/index.astro` and `en/index.astro` are the same with `getTranslations('fr'|'en')`, the matching `canonical`/`url` (`https://flightbook.ch/fr`, `.../en`), and `locale="fr"|"en"`. Note the current `fr/index.astro` is **missing** the language-detection script that `index.astro` has — add it to all three so a stored preference is honoured from any entry point.

- [ ] **Step 3: Create the English secondary pages**

Copy `src/pages/fr/privacy-policy.astro` and `src/pages/fr/help.astro` to `src/pages/en/`, translating the copy. If either French page embeds its text inline rather than reading the i18n table, keep that pattern and translate in place — do not restructure them in this task.

- [ ] **Step 4: Full verification**

Run: `npm test && npm run fix && npm run build && npm run check`
Expected: 14 tests pass, build succeeds, check passes.

Then:

```bash
grep -o 'lang="[a-z]*"' dist/index.html dist/fr/index.html dist/en/index.html
grep -c 'id="premium"\|id="angebot"\|id="schools"\|id="tandem"\|id="faq"' dist/index.html
```

Expected: `de`, `fr`, `en` respectively; and 5 anchor ids present.

Then `npm run preview` and walk all three locales at 375px, 768px, and 1440px. Confirm specifically:
- Section order is Hero → Funktionalitäten → Pricing → Schools → Tandem → FAQ.
- The three carousels are independent.
- The language pill round-trips: `/` → `/fr` → `/en` → `/`, and from `/en/privacy-policy` back to `/privacy-policy`.
- No horizontal scrollbar at 375px on any locale.

- [ ] **Step 5: Record the outstanding asset swaps**

Append to the spec's *Assets* section a short "Pending" list naming the exact import to change once Joel supplies each file:

| Asset | Interim | Import to change |
| --- | --- | --- |
| Hero photo | `hero-image.png` | `FlightbookHome.astro` → `heroPhoto` |
| Tandem photo | `hero-image.png` | `FlightbookHome.astro` → tandem `photo` |
| Passenger confirmation | `home.png` | `FlightbookHome.astro` → tandem `screenshot` |

Also note there that the five app screenshots in the design project are newer than the repo's copies and none byte-match, so all five are worth replacing, not just the missing one.

- [ ] **Step 6: Commit**

```bash
git add src/pages src/components/FlightbookHome.astro docs/superpowers/specs
git commit -m "feat(pages): compose redesigned homepage across de/fr/en"
```

---

## Self-Review

**Spec coverage.** Foundations → Task 2. Component table → Tasks 3, 5-12. Page structure and anchor freeze → Task 13 plus Global Constraints. i18n including the `lang` bug → Tasks 1, 4, 5, 13. Copy corrections → Task 4 Steps 1-3. Assets and responsive authorship → Tasks 6-10 and 13 Step 5. Verification → Task 13 Step 4. Out-of-scope items are untouched by every task above.

**Known gaps handed forward.** Three assets ship as interim placeholders (Task 13 Step 5). The Tandem screenshot is the only one with no true equivalent in the repo. English `meta` strings are authored rather than sourced, since the design has no `meta` entries — flagged in Task 4 Step 3.

**Type consistency.** `Locale` is defined once in Task 1 and imported everywhere after. `getHeaderData`/`getFooterData` are named identically in Task 5 Step 1, consumed in Task 5 Step 4 and Task 12. `ImageCarousel`'s prop names (`images`, `theme`, `showCaption`, `autoAdvanceMs`) match between Task 3 and its three call sites in Tasks 7 and 9. `PhoneFrame`'s `radius` values (`lg`/`md`/`sm`) match its uses in Tasks 6, 7, and 10. The `features.captions` array is written in Task 4 and indexed in Task 13 Step 1.
