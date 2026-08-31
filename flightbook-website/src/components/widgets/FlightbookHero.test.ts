import { describe, expect, it } from 'vitest';
import type { ImageMetadata } from 'astro';
import { render, count } from '~/test/render';
import FlightbookHero from '~/components/widgets/FlightbookHero.astro';

const photo: ImageMetadata = { src: '/photo.jpg', width: 5184, height: 3456, format: 'jpg' };
const screenshot: ImageMetadata = { src: '/screenshot.png', width: 288, height: 580, format: 'png' };

const stats = [
  { value: 'SHV zugelassen', label: 'an der Prüfung anerkannt' },
  { value: 'Flüge erfassen', label: 'Flugbuch verwalten' },
  { value: 'Fortschritt tracken', label: 'für angehende Pilot*innen' },
  { value: 'Höhenflüge organisieren', label: 'für Flugschulen' },
];

const baseProps = {
  eyebrow: 'Für angehende Pilot:innen · erfahrene Expert:innen · Flugschulen',
  titleLine1: 'Dein Flugbuch',
  titleLine2: 'fliegt mit.',
  subtitle: 'Das digitale Flugbuch für Gleitschirm und Delta - SHV zugelassen',
  ios: 'iOS',
  android: 'Android',
  premium: 'Flightbook Premium abonnieren →',
  stats,
  photo,
  screenshot,
  screenshotAlt: 'Flightbook App Startseite',
};

describe('FlightbookHero', () => {
  it('carries the frozen section id', async () => {
    const html = await render(FlightbookHero, baseProps);
    expect(html).toContain('id="top"');
  });

  it('renders both headline lines plus the eyebrow and subtitle', async () => {
    const html = await render(FlightbookHero, baseProps);
    expect(html).toContain(baseProps.titleLine1);
    expect(html).toContain(baseProps.titleLine2);
    expect(html).toContain(baseProps.eyebrow);
    expect(html).toContain(baseProps.subtitle);
  });

  it('renders one stat list item per entry, each with its value and label', async () => {
    const html = await render(FlightbookHero, baseProps);
    expect(count(html, /<li[ >]/)).toBe(4);
    for (const stat of stats) {
      expect(html).toContain(stat.value);
      expect(html).toContain(stat.label);
    }
  });

  it('renders a partial stat strip when fewer stats are passed', async () => {
    const html = await render(FlightbookHero, { ...baseProps, stats: stats.slice(0, 3) });
    expect(count(html, /<li[ >]/)).toBe(3);
  });

  it('renders the three CTA links with the exact hrefs and store-link attributes', async () => {
    const html = await render(FlightbookHero, baseProps);
    expect(html).toContain('href="https://apps.apple.com/ch/app/flightbook/id1046316231"');
    expect(html).toContain('href="https://play.google.com/store/apps/details?id=ch.flightbook.MobileFlight"');
    expect(html).toContain('href="https://m.flightbook.ch/settings"');

    const appStoreMatch = html.match(/<a href="https:\/\/apps\.apple\.com[^>]*>/)?.[0] ?? '';
    const playStoreMatch = html.match(/<a href="https:\/\/play\.google\.com[^>]*>/)?.[0] ?? '';
    for (const tag of [appStoreMatch, playStoreMatch]) {
      expect(tag).toContain('target="_blank"');
      expect(tag).toMatch(/rel="[^"]*noopener[^"]*"/);
    }
  });

  it('marks the hero photo eager and high-priority for LCP', async () => {
    const html = await render(FlightbookHero, baseProps);
    const imgTag = html.match(/<img[^>]*photo\.jpg[^>]*>/)?.[0] ?? '';
    expect(imgTag).toContain('loading="eager"');
    expect(imgTag).toContain('fetchpriority="high"');
  });

  it('gives the phone screenshot a real, translated alt text', async () => {
    const html = await render(FlightbookHero, baseProps);
    const imgTag = html.match(/<img[^>]*screenshot\.png[^>]*>/)?.[0] ?? '';
    expect(imgTag).toContain(`alt="${baseProps.screenshotAlt}"`);
  });

  it('does not carry the old header-offset margin', async () => {
    const html = await render(FlightbookHero, baseProps);
    expect(html).not.toContain('md:-mt-[76px]');
  });
});
