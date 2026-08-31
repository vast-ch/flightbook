import { describe, expect, it } from 'vitest';
import type { ImageMetadata } from 'astro';
import { render, count } from '~/test/render';
import FlightbookTandem from '~/components/widgets/FlightbookTandem.astro';

const photo: ImageMetadata = { src: '/photo.jpg', width: 3585, height: 2248, format: 'jpg' };
const screenshot: ImageMetadata = { src: '/screenshot.png', width: 1179, height: 2556, format: 'png' };

const items = [
  {
    title: 'Passagierbestätigung erfassen',
    description: 'Erfasse die vom SHV geforderte Bestätigung direkt auf dem Handy.',
  },
  {
    title: 'Einnahmen tracken',
    description: 'Hinterlege pro Tandemflug den Betrag und behalte den Überblick über deine Einnahmen.',
  },
  {
    title: 'Bestätigungen exportieren',
    description: 'Alle Bestätigungen bleiben in deinem Konto gespeichert und lassen sich exportieren.',
  },
  {
    title: 'Mehrsprachig briefen',
    description: 'Deine Passagiere lesen und unterschreiben die Bestätigung in ihrer Sprache.',
  },
];

const baseProps = {
  eyebrow: 'Für Tandem Piloten',
  title: 'Flightbook für Tandem Piloten',
  intro: 'Wer gewerblich fliegt, hat mehr zu verwalten als nur Flüge.',
  cta: 'Registrieren',
  items,
  photo,
  screenshot,
  screenshotAlt: 'Flightbook App Startseite',
};

describe('FlightbookTandem', () => {
  it('carries the frozen section id', async () => {
    const html = await render(FlightbookTandem, baseProps);
    expect(html).toContain('id="tandem"');
  });

  it('renders all four sub-feature headings with their descriptions', async () => {
    const html = await render(FlightbookTandem, baseProps);
    for (const item of items) {
      expect(html).toContain(item.title);
      expect(html).toContain(item.description);
    }
    expect(count(html, /<h3\b/g)).toBe(4);
  });

  it('renders three sub-feature headings when only three items are passed, proving the grid is data-driven', async () => {
    const html = await render(FlightbookTandem, { ...baseProps, items: items.slice(0, 3) });
    expect(count(html, /<h3\b/g)).toBe(3);
  });

  it('renders the eyebrow and the h2 title text', async () => {
    const html = await render(FlightbookTandem, baseProps);
    expect(html).toContain(baseProps.eyebrow);
    const h2Match = html.match(/<h2[^>]*>([^<]*)<\/h2>/);
    expect(h2Match?.[1]).toBe(baseProps.title);
  });

  it('links the CTA to registration, opened in a new tab with noopener', async () => {
    const html = await render(FlightbookTandem, baseProps);
    const ctaMatch = html.match(/<a href="https:\/\/m\.flightbook\.ch\/register"[^>]*>/)?.[0] ?? '';
    expect(ctaMatch).toContain('target="_blank"');
    expect(ctaMatch).toMatch(/rel="[^"]*noopener[^"]*"/);
    expect(html).toContain(baseProps.cta);
  });

  it('renders exactly one static phone bezel and no carousel root', async () => {
    const html = await render(FlightbookTandem, baseProps);
    expect(count(html, /data-phone-frame/g)).toBe(1);
    expect(html).not.toContain('data-carousel');
  });

  it('gives the phone screenshot a real, translated alt text, and leaves the decorative photo alt empty', async () => {
    const html = await render(FlightbookTandem, baseProps);
    const screenshotTag = html.match(/<img[^>]*screenshot\.png[^>]*>/)?.[0] ?? '';
    expect(screenshotTag).toContain(`alt="${baseProps.screenshotAlt}"`);

    const photoTag = html.match(/<img[^>]*photo\.jpg[^>]*>/)?.[0] ?? '';
    expect(photoTag).toMatch(/\salt(="")?[\s>]/);
  });
});
