import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveRedirectTarget } from '~/utils/language-detector';

describe('resolveRedirectTarget', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends a first-time French browser from the root to /fr', () => {
    expect(
      resolveRedirectTarget({
        path: '/',
        hash: '',
        langParam: null,
        isFirstVisit: true,
        storedLang: null,
        browserLang: 'fr-CH',
      })
    ).toBe('/fr');
  });

  it('sends a first-time English browser from the root to /en', () => {
    expect(
      resolveRedirectTarget({
        path: '/',
        hash: '',
        langParam: null,
        isFirstVisit: true,
        storedLang: null,
        browserLang: 'en-GB',
      })
    ).toBe('/en');
  });

  it('leaves a first-time German browser alone', () => {
    expect(
      resolveRedirectTarget({
        path: '/',
        hash: '',
        langParam: null,
        isFirstVisit: true,
        storedLang: null,
        browserLang: 'de-CH',
      })
    ).toBeNull();
  });

  it('never auto-redirects away from a deep link', () => {
    expect(
      resolveRedirectTarget({
        path: '/privacy-policy',
        hash: '',
        langParam: null,
        isFirstVisit: true,
        storedLang: null,
        browserLang: 'fr-CH',
      })
    ).toBeNull();
  });

  it('honours the legacy ?lang= parameter', () => {
    expect(
      resolveRedirectTarget({
        path: '/',
        hash: '#faq',
        langParam: 'en',
        isFirstVisit: false,
        storedLang: null,
        browserLang: 'de-CH',
      })
    ).toBe('/en#faq');
  });

  it('honours a stored preference on a return visit', () => {
    expect(
      resolveRedirectTarget({
        path: '/',
        hash: '',
        langParam: null,
        isFirstVisit: false,
        storedLang: 'en',
        browserLang: 'de-CH',
      })
    ).toBe('/en');
  });

  it('returns null when the stored preference already matches the page', () => {
    expect(
      resolveRedirectTarget({
        path: '/en',
        hash: '',
        langParam: null,
        isFirstVisit: false,
        storedLang: 'en',
        browserLang: 'de-CH',
      })
    ).toBeNull();
  });

  it('sends a stored German preference back to the root', () => {
    expect(
      resolveRedirectTarget({
        path: '/fr',
        hash: '',
        langParam: null,
        isFirstVisit: false,
        storedLang: 'de',
        browserLang: 'fr-CH',
      })
    ).toBe('/');
  });
});
