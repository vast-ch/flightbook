import { describe, expect, it } from 'vitest';
import { getLocaleFromUrl, getTranslations, type Locale } from '~/utils/i18n';
import deTrans from '~/content/i18n/de.json';
import frTrans from '~/content/i18n/fr.json';
import enTrans from '~/content/i18n/en.json';

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

// N7: components index the three locale tables positionally (e.g. `stats[i]`, `faqs[i].steps`).
// Nothing catches a length mismatch at runtime - a short array yields `alt={undefined}`, which
// Astro OMITS from the output, so the existing "no undefined leaks" tests can't catch it either.
// `Record<Locale, typeof deTrans>` in i18n.ts catches a *key* divergence at compile time, but
// TypeScript infers plain `string[]` (not a fixed-length tuple) from a JSON array literal, so an
// array-length mismatch is invisible to the type system. This test is the other half: walk every
// locale table and assert de/fr/en have identical key paths AND identical array lengths at every
// level, recursively.
describe('i18n table parity (de/fr/en)', () => {
  type Shape = string | number | { [key: string]: Shape } | Shape[];

  /** Reduces a translation table to its structure only: key paths, and array lengths, not values. */
  function shapeOf(value: unknown): Shape {
    if (Array.isArray(value)) {
      return value.map(shapeOf);
    }
    if (value !== null && typeof value === 'object') {
      const out: { [key: string]: Shape } = {};
      for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        out[key] = shapeOf((value as Record<string, unknown>)[key]);
      }
      return out;
    }
    // Leaf values don't matter for parity - only their presence (captured by the parent
    // object's key set) and, for arrays, their count (captured by .length above).
    return typeof value;
  }

  const locales: [Locale, unknown][] = [
    ['fr', frTrans],
    ['en', enTrans],
  ];

  it.each(locales)('%s has the same key paths and array lengths as de', (_locale, table) => {
    expect(shapeOf(table)).toEqual(shapeOf(deTrans));
  });

  it('the reference table itself is non-trivial (guards against a vacuous pass)', () => {
    expect(Array.isArray(deTrans.hero.stats)).toBe(true);
    expect((deTrans.hero.stats as unknown[]).length).toBeGreaterThan(0);
    expect(Array.isArray(deTrans.faq.questions)).toBe(true);
  });
});
