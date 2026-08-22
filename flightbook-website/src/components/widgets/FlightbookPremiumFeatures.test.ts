import { describe, expect, it } from 'vitest';
import type { ImageMetadata } from 'astro';
import { render, count } from '~/test/render';
import FlightbookPremiumFeatures from '~/components/widgets/FlightbookPremiumFeatures.astro';

const stub: ImageMetadata = { src: '/x.png', width: 1, height: 1, format: 'png' };

const items = Array.from({ length: 8 }, (_, i) => ({
  title: `Feature ${i + 1}`,
  description: `Description text for feature number ${i + 1}.`,
}));

const screenshots = Array.from({ length: 4 }, (_, i) => ({
  src: stub,
  alt: `Screenshot ${i + 1}`,
  caption: `Caption for slide ${i + 1}`,
}));

const baseProps = {
  title: 'Funktionalitäten',
  intro: 'Alles, was du nach der Landung brauchst — in einer App.',
  cta: 'Registrieren',
  items,
  screenshots,
};

describe('FlightbookPremiumFeatures', () => {
  it('carries the frozen section id', async () => {
    const html = await render(FlightbookPremiumFeatures, baseProps);
    expect(html).toContain('id="premium"');
  });

  it('renders one card per item, each with its title and description', async () => {
    const html = await render(FlightbookPremiumFeatures, baseProps);
    expect(count(html, /<h3[ >]/g)).toBe(8);
    for (const item of items) {
      expect(html).toContain(item.title);
      expect(html).toContain(item.description);
    }
  });

  it('renders exactly one CTA anchor that opens registration in a new tab', async () => {
    const html = await render(FlightbookPremiumFeatures, baseProps);
    expect(count(html, /href="https:\/\/m\.flightbook\.ch\/register"/g)).toBe(1);
    const ctaTag = html.match(/<a[^>]*href="https:\/\/m\.flightbook\.ch\/register"[^>]*>/)?.[0] ?? '';
    expect(ctaTag).toContain('target="_blank"');
    expect(ctaTag).toMatch(/rel="[^"]*noopener[^"]*"/);
  });

  it('renders exactly one carousel root for the whole section', async () => {
    const html = await render(FlightbookPremiumFeatures, baseProps);
    expect(count(html, /data-carousel\b/g)).toBe(1);
  });

  // FIX ROUND 1 gave the whole carousel (images + controls) a phone bezel, which put the
  // dark-theme controls on a white background inside it. FIX ROUND 2: ImageCarousel's new
  // `frame` prop puts the bezel around only the images, so this section no longer wraps
  // ImageCarousel in a separate <PhoneFrame> itself — it delegates via the prop instead.
  it('frames only the carousel images in a single phone bezel', async () => {
    const html = await render(FlightbookPremiumFeatures, baseProps);
    expect(count(html, /data-phone-frame/g)).toBe(1);
  });

  it('uses the dark carousel theme, since the controls sit on the section’s dark background (not inside the bezel)', async () => {
    const html = await render(FlightbookPremiumFeatures, baseProps);
    expect(html).toContain('data-active-dot="bg-sky"');
    expect(html).not.toContain('data-active-dot="bg-brand"');
  });

  it('renders no per-feature icon svgs', async () => {
    const html = await render(FlightbookPremiumFeatures, baseProps);
    expect(html).not.toContain('<svg');
  });

  it('is data-driven: six items render six cards, not a hard-coded eight', async () => {
    const html = await render(FlightbookPremiumFeatures, { ...baseProps, items: items.slice(0, 6) });
    expect(count(html, /<h3[ >]/g)).toBe(6);
  });

  it('shows the carousel caption text as data for each screenshot', async () => {
    const html = await render(FlightbookPremiumFeatures, baseProps);
    // Server-rendered first caption (the paragraph's initial content).
    expect(html).toContain(screenshots[0].caption);
    // Every slide's caption is present as data on its dot, for the client script to read on advance.
    for (const shot of screenshots) {
      expect(html).toContain(`data-caption="${shot.caption}"`);
    }
    // Exactly one element carries the caption-text marker, and it resolves to a <p>, not a dot.
    expect(count(html, /data-caption-text/g)).toBe(1);
    const captionTag = html.match(/<[a-z]+[^>]*\bdata-caption-text\b[^>]*>/)?.[0];
    expect(captionTag).toMatch(/^<p\b/);
  });
});
