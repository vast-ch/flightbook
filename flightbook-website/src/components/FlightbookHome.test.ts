import { describe, expect, it } from 'vitest';
import { render } from '~/test/render';
import FlightbookHome from '~/components/FlightbookHome.astro';
import type { Locale } from '~/utils/i18n';

const locales: Locale[] = ['de', 'fr', 'en'];

const frozenIds = ['id="top"', 'id="premium"', 'id="angebot"', 'id="schools"', 'id="tandem"', 'id="faq"'];

// One locale-distinguishing string per locale, verified to not be a substring
// of either other locale's counterpart (t.hero.titleLine1).
const titleLine1ByLocale: Record<Locale, string> = {
  de: 'Dein Flugbuch',
  fr: 'Ton carnet de vol',
  en: 'Your logbook',
};

describe('FlightbookHome', () => {
  for (const locale of locales) {
    it(`renders the six frozen section ids in the frozen order for locale=${locale}`, async () => {
      const html = await render(FlightbookHome, { locale });

      const indices = frozenIds.map((id) => html.indexOf(id));
      for (const [i, index] of indices.entries()) {
        expect(index, `expected ${frozenIds[i]} to be present`).toBeGreaterThan(-1);
      }
      for (let i = 1; i < indices.length; i++) {
        expect(indices[i], `expected ${frozenIds[i]} to come after ${frozenIds[i - 1]}`).toBeGreaterThan(
          indices[i - 1]
        );
      }
    });

    it(`leaks no "undefined" or "[object Object]" into the rendered output for locale=${locale}`, async () => {
      const html = await render(FlightbookHome, { locale });

      expect(html).not.toContain('undefined');
      expect(html).not.toContain('[object Object]');
    });
  }

  it('threads locale="en" through getTranslations rather than defaulting to German', async () => {
    const html = await render(FlightbookHome, { locale: 'en' });

    expect(html).toContain(titleLine1ByLocale.en);
    expect(html).not.toContain(titleLine1ByLocale.de);
    expect(html).not.toContain(titleLine1ByLocale.fr);
  });

  it('threads locale="fr" through getTranslations rather than defaulting to German', async () => {
    const html = await render(FlightbookHome, { locale: 'fr' });

    expect(html).toContain(titleLine1ByLocale.fr);
    expect(html).not.toContain(titleLine1ByLocale.de);
    expect(html).not.toContain(titleLine1ByLocale.en);
  });
});
