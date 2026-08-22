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
