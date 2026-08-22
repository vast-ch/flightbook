import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { render, count } from '~/test/render';
import ImageCarousel from '~/components/ui/ImageCarousel.astro';

const componentPath = fileURLToPath(new URL('./ImageCarousel.astro', import.meta.url));
const source = fs.readFileSync(componentPath, 'utf-8');

const stub = { src: '/x.png', width: 1, height: 1, format: 'png' as const };
const images = [
  { src: stub, alt: 'one', caption: 'First' },
  { src: stub, alt: 'two', caption: 'Second' },
  { src: stub, alt: 'three', caption: 'Third' },
];

/**
 * Returns the outerHTML of the first balanced <div ...>...</div> whose opening tag
 * contains `marker`, by walking div-open/div-close tokens and counting depth. Used to
 * check real containment (is X actually nested inside Y) rather than mere presence.
 */
function extractDiv(html: string, marker: string): string {
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) throw new Error(`marker "${marker}" not found in html`);
  const openStart = html.lastIndexOf('<div', markerIndex);
  const tagRe = /<div\b[^>]*>|<\/div>/g;
  tagRe.lastIndex = openStart;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html))) {
    if (match[0].startsWith('</div')) {
      depth--;
      if (depth === 0) return html.slice(openStart, match.index + match[0].length);
    } else {
      depth++;
    }
  }
  throw new Error(`unbalanced <div> starting at ${openStart}`);
}

describe('ImageCarousel', () => {
  it('emits one slide and one dot per image', async () => {
    const html = await render(ImageCarousel, { images });
    expect(count(html, /data-slide/g)).toBe(3);
    expect(count(html, /data-dot/g)).toBe(3);
  });

  it('shows only the first slide initially', async () => {
    const html = await render(ImageCarousel, { images });
    expect(count(html, /data-slide[^>]*class="[^"]*\bhidden\b/g)).toBe(2);
  });

  it('scopes itself to a root so instances do not collide', async () => {
    const html = await render(ImageCarousel, { images });
    expect(count(html, /data-carousel\b/g)).toBe(1);
  });

  // RULING R3: `expect(html).not.toContain("document.querySelector('.slide-nav")` from the
  // brief cannot work as a render test — Astro bundles the client <script> body to an
  // external module, so the Container API's renderToString output never contains the script
  // text at all. The assertion would pass vacuously regardless of what the script does, which
  // proves nothing about the bug this component exists to prevent. We instead read the
  // component source directly and assert every page-global `document.querySelector(All)`
  // call is the one, intentional call that discovers carousel roots (`[data-carousel]`) —
  // every other query (slides, dots, prev/next buttons, caption) must be scoped to `root`.
  it('never queries slides, dots, or nav buttons with a page-global selector (source check)', () => {
    const globalQueries = source.match(/document\.querySelectorAll?(?:<[^>]*>)?\([^)]*\)/g) ?? [];
    expect(globalQueries.length).toBeGreaterThan(0);
    for (const call of globalQueries) {
      expect(call).toContain("'[data-carousel]'");
    }
    // Belt-and-suspenders: the old bug's exact selectors must not appear as page-global queries.
    expect(source).not.toMatch(/document\.querySelectorAll?(?:<[^>]*>)?\(\s*['"]\.(slide|slide-nav|indicator|dot)/);
  });

  it('carries the auto-advance interval as data, not a closure constant', async () => {
    const html = await render(ImageCarousel, { images, autoAdvanceMs: 1234 });
    expect(html).toContain('data-interval="1234"');
  });

  it('renders a caption only when asked', async () => {
    // RULING R2: the dots must not carry data-caption unless showCaption is set — otherwise
    // this assertion (lifted verbatim from the brief) would fail, since the brief's Step 2
    // addendum would put data-caption on every dot regardless of showCaption.
    expect(await render(ImageCarousel, { images })).not.toContain('data-caption=');
    const withCaption = await render(ImageCarousel, { images, showCaption: true });
    expect(withCaption).toContain('First');
  });

  it('labels its controls for screen readers', async () => {
    const html = await render(ImageCarousel, { images });
    expect(html).toContain('aria-label="Previous slide"');
    expect(html).toContain('aria-label="Next slide"');
    expect(count(html, /aria-label="Go to slide \d"/g)).toBe(3);
  });

  // FIX ROUND 1 REGRESSION: dots carry `data-caption` (their per-slide caption *source*, read
  // by the script when captions is built), and the caption <p> used to carry that same
  // `data-caption` attribute as its own marker. Since dots precede the <p> in DOM order,
  // `root.querySelector('[data-caption]')` resolved to the FIRST DOT, not the paragraph — so
  // advancing the carousel wrote caption text into a 7x7px dot button and the real paragraph
  // never updated past its server-rendered first value. Fixed by giving the paragraph its own
  // attribute (`data-caption-text`) so the two selectors can never resolve to the same element.
  it('reads the caption element with a selector that cannot resolve to a dot button (source check)', () => {
    const captionQuery = source.match(/const caption = root\.querySelector<HTMLElement>\(([^)]*)\)/)?.[1];
    expect(captionQuery).toBeDefined();
    // Must not be the bare selector the dots also carry — that's exactly the collision that shipped.
    expect(captionQuery).not.toBe("'[data-caption]'");
    expect(captionQuery).toContain('data-caption-text');
  });

  it('gives the caption paragraph a selector disjoint from the dots (render check)', async () => {
    const html = await render(ImageCarousel, { images, showCaption: true });

    // Exactly one element in the whole render carries data-caption-text, and it's a <p>.
    expect(count(html, /data-caption-text/g)).toBe(1);
    const captionTag = html.match(/<[a-z]+[^>]*\bdata-caption-text\b[^>]*>/)?.[0];
    expect(captionTag).toMatch(/^<p\b/);

    // Every dot carries the per-slide `data-caption` source attribute, but never the
    // paragraph's `data-caption-text` marker — the two selectors are disjoint by construction.
    const dotTags = html.match(/<button[^>]*\bdata-dot\b[^>]*>/g) ?? [];
    expect(dotTags.length).toBe(3);
    for (const tag of dotTags) {
      expect(tag).toContain('data-caption=');
      expect(tag).not.toContain('data-caption-text');
    }
  });

  // FIX ROUND 2, FINDING 2: the script used to derive the active-dot class by pattern-matching
  // `dots[0].className` for `/bg-(sky|brand)/` — reading the component's own Tailwind class back
  // out of the DOM. If `dotOn`'s literal values ever changed, that regex would silently fall
  // back to the wrong theme's class, and no test could catch it (the testing standard forbids
  // pinning Tailwind class strings). Fixed by passing the value as data from the server — the
  // same variable used in the dot's class:list — so the two can never diverge.
  it('passes the active-dot class as data on the root instead of deriving it from a dot (render check)', async () => {
    const dark = await render(ImageCarousel, { images, theme: 'dark' });
    const light = await render(ImageCarousel, { images, theme: 'light' });
    expect(dark).toMatch(/data-active-dot="bg-sky"/);
    expect(light).toMatch(/data-active-dot="bg-brand"/);
    expect(dark).not.toContain(light.match(/data-active-dot="[^"]*"/)?.[0]);
  });

  it("no longer derives the active dot class by reading a dot's own className (source check)", () => {
    expect(source).not.toMatch(/\.className\.match\(/);
    expect(source).toContain('root.dataset.activeDot');
  });

  // FIX ROUND 3: FlightbookPremiumFeatures needed the phone-bezel frame around only the
  // slides, with controls/caption as siblings below it. `frame` is opt-in specifically so
  // Tasks 9 and 10's existing (unframed) carousels keep their current shape unchanged.
  it('renders no PhoneFrame bezel and no figure shell when frame is omitted (guards other consumers against regression)', async () => {
    const html = await render(ImageCarousel, { images });
    expect(html).not.toContain('data-phone-frame');
    expect(html).not.toContain('data-figure-frame');
  });

  it('wraps only the slides in the PhoneFrame bezel when frame is set; controls and caption stay outside it', async () => {
    const html = await render(ImageCarousel, { images, frame: 'md', showCaption: true });

    // Exactly one bezel, and it actually contains every slide.
    expect(count(html, /data-phone-frame/g)).toBe(1);
    const frameHtml = extractDiv(html, 'data-phone-frame');
    expect(count(frameHtml, /data-slide/g)).toBe(images.length);

    // The containment check the brief calls for: controls and caption must NOT be
    // nested inside the bezel element, only positioned after it as siblings.
    expect(frameHtml).not.toContain('data-prev');
    expect(frameHtml).not.toContain('data-next');
    expect(frameHtml).not.toContain('data-dot');
    expect(frameHtml).not.toContain('data-caption-text');

    // A phone-bezel carousel must not also render the figure shell.
    expect(html).not.toContain('data-figure-frame');
  });

  // FIX ROUND 4 (RULING R19): browser/app screenshots that need a bordered white card —
  // not a phone bezel — get a second frame variant. It must be a genuine alternative to
  // `lg`/`md`/`sm`, not an addition, so a figure-framed carousel must never also carry the
  // PhoneFrame bezel, and vice versa (asserted above).
  it('wraps only the slides in the figure shell when frame="figure"; controls and caption stay outside it', async () => {
    const html = await render(ImageCarousel, { images, frame: 'figure', showCaption: true });

    // Exactly one shell, and it actually contains every slide.
    expect(count(html, /data-figure-frame/g)).toBe(1);
    const shellHtml = extractDiv(html, 'data-figure-frame');
    expect(count(shellHtml, /data-slide/g)).toBe(images.length);

    // Containment, not mere presence: controls and caption must NOT be nested inside the
    // shell element, only positioned after it as siblings — the same guarantee `frame="md"`
    // gets, so a figure-framed carousel can't regress into re-nesting them.
    expect(shellHtml).not.toContain('data-prev');
    expect(shellHtml).not.toContain('data-next');
    expect(shellHtml).not.toContain('data-dot');
    expect(shellHtml).not.toContain('data-caption-text');

    // A figure-framed carousel must not also render the phone bezel.
    expect(html).not.toContain('data-phone-frame');
  });

  // FIX ROUND 2, FINDING 1: nothing cleared a running `setInterval` before ClientRouter (enabled
  // site-wide via <ClientRouter /> in Layout.astro) swaps the DOM out for a view transition, so
  // an auto-advancing carousel kept ticking against detached nodes after every navigation — and
  // this compounds, since the homepage carries three carousels. This is client-only behaviour
  // that `renderToString` cannot exercise, so the coverage is a source check: the script must
  // register an `astro:before-swap` teardown, and that teardown must actually call
  // `clearInterval` (not just observe the event) so it isn't a vacuous assertion.
  it('sweeps active timers on astro:before-swap so intervals do not leak across view transitions (source check)', () => {
    expect(source).toMatch(/document\.addEventListener\(\s*['"]astro:before-swap['"]/);
    const beforeSwapIndex = source.indexOf('astro:before-swap');
    expect(beforeSwapIndex).toBeGreaterThan(-1);
    const registration = source.slice(beforeSwapIndex, beforeSwapIndex + 200);
    const handlerName = registration.match(/astro:before-swap['"]\s*,\s*(\w+)/)?.[1];
    expect(handlerName).toBeDefined();
    const handlerBody = source.match(new RegExp(`function ${handlerName}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n  \\}`));
    expect(handlerBody?.[1]).toMatch(/clearInterval/);
  });

  // N6 (WCAG 2.2.2): auto-advance had no way to disable it - pause was mouseenter-only, so it
  // was unreachable by keyboard or touch. This is client-only behaviour that `renderToString`
  // cannot exercise (same reasoning as the source checks above), so we check the source: the
  // function that arms the interval must bail out under prefers-reduced-motion, before it ever
  // calls setInterval.
  it('does not auto-advance under prefers-reduced-motion (source check)', () => {
    const startMatch = source.match(/function start\s*\(\)\s*\{([\s\S]*?)\n {6}\}/);
    expect(startMatch).not.toBeNull();
    const startBody = startMatch![1];

    expect(startBody).toMatch(/matchMedia\(\s*['"]\(prefers-reduced-motion:\s*reduce\)['"]\s*\)/);

    // The reduced-motion check must come before setInterval is armed, not after.
    const matchMediaIndex = startBody.indexOf('matchMedia');
    const setIntervalIndex = startBody.indexOf('setInterval');
    expect(matchMediaIndex).toBeGreaterThan(-1);
    expect(setIntervalIndex).toBeGreaterThan(-1);
    expect(matchMediaIndex).toBeLessThan(setIntervalIndex);
  });
});
