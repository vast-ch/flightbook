/**
 * Browser language detection and auto-redirect for Flightbook.
 * The decision logic is pure so it can be tested without a DOM.
 */

import type { Locale } from '~/utils/i18n';

const LOCALES: Locale[] = ['de', 'fr', 'en'];

interface DetectionInput {
  path: string;
  hash: string;
  langParam: string | null;
  isFirstVisit: boolean;
  storedLang: string | null;
  browserLang: string;
}

function pathForLocale(locale: Locale, hash: string): string {
  return locale === 'de' ? `/${hash}` : `/${locale}${hash}`;
}

function localeOfPath(path: string): Locale {
  const segment = path.split('/')[1];
  return segment === 'fr' || segment === 'en' ? segment : 'de';
}

function isLocale(value: string | null): value is Locale {
  return value !== null && (LOCALES as string[]).includes(value);
}

/** Returns the path to redirect to, or null to stay put. */
export function resolveRedirectTarget(input: DetectionInput): string | null {
  const { path, hash, langParam, isFirstVisit, storedLang, browserLang } = input;
  const current = localeOfPath(path);

  // Legacy ?lang= wins over everything.
  if (isLocale(langParam) && langParam !== current) {
    return pathForLocale(langParam, hash);
  }

  // Auto-detect only on a first visit to the root, never on a deep link.
  if (isFirstVisit && path === '/') {
    const detected = LOCALES.find((l) => browserLang.toLowerCase().startsWith(l));
    return detected && detected !== 'de' ? pathForLocale(detected, hash) : null;
  }

  // Return visits honour the stored preference.
  if (!isFirstVisit && isLocale(storedLang) && storedLang !== current) {
    return pathForLocale(storedLang, hash);
  }

  return null;
}

export function initLanguageDetection() {
  if (typeof window === 'undefined') return;

  try {
    const isFirstVisit = !localStorage.getItem('flightbook-visited');
    if (isFirstVisit) {
      localStorage.setItem('flightbook-visited', 'true');
    }

    const target = resolveRedirectTarget({
      path: window.location.pathname,
      hash: window.location.hash,
      langParam: new URLSearchParams(window.location.search).get('lang'),
      isFirstVisit,
      storedLang: localStorage.getItem('flightbook-lang'),
      browserLang: navigator.language || 'de',
    });

    if (target) {
      window.location.href = target;
    }
  } catch (e) {
    console.warn('Language detection error:', e);
  }
}
