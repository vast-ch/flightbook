import { describe, expect, it } from 'vitest';
import { render, count } from '~/test/render';
import LanguageSwitcher from './LanguageSwitcher.astro';
import type { Locale } from '~/utils/i18n';

/** Extracts the full opening `<a ...>` tag for a given data-lang value, attribute order agnostic. */
function tagFor(html: string, lang: string): string | undefined {
  return html.match(new RegExp(`<a\\b[^>]*data-lang="${lang}"[^>]*>`))?.[0];
}

function hrefFrom(tag: string | undefined): string | undefined {
  return tag?.match(/href="([^"]*)"/)?.[1];
}

describe('LanguageSwitcher', () => {
  it('renders exactly three links labelled DE, FR, EN', async () => {
    const html = await render(LanguageSwitcher, { currentLocale: 'de' });

    expect(count(html, /<a\b/g)).toBe(3);
    expect(html).toMatch(/>\s*DE\s*</);
    expect(html).toMatch(/>\s*FR\s*</);
    expect(html).toMatch(/>\s*EN\s*</);
  });

  it.each<[Locale, string]>([
    ['de', '/'],
    ['fr', '/fr'],
    ['en', '/en'],
  ])('marks only %s as aria-current, with root href %s', async (locale, expectedHref) => {
    const html = await render(LanguageSwitcher, { currentLocale: locale });

    expect(count(html, /aria-current="true"/g)).toBe(1);

    const current = (['de', 'fr', 'en'] as const).find((l) => tagFor(html, l)?.includes('aria-current="true"'));
    expect(current).toBe(locale);
    expect(hrefFrom(tagFor(html, locale))).toBe(expectedHref);
  });

  it('links to the correct href for each locale from the root path', async () => {
    const html = await render(LanguageSwitcher, { currentLocale: 'de' });

    expect(hrefFrom(tagFor(html, 'de'))).toBe('/');
    expect(hrefFrom(tagFor(html, 'fr'))).toBe('/fr');
    expect(hrefFrom(tagFor(html, 'en'))).toBe('/en');
  });
});
