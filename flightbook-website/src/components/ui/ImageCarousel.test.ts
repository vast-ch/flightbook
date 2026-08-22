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
});
