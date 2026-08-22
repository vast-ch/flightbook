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
});
