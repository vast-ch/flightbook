import deTrans from '~/content/i18n/de.json';
import frTrans from '~/content/i18n/fr.json';
import enTrans from '~/content/i18n/en.json';

export type Locale = 'de' | 'fr' | 'en';

// Typed against de's structure so a structural divergence (a missing key, or an array of a
// different length) in fr/en is a compile error, not a silent `undefined` at render time.
const translations: Record<Locale, typeof deTrans> = {
  de: deTrans,
  fr: frTrans,
  en: enTrans,
};

export function getTranslations(locale: Locale) {
  return translations[locale] || translations.de;
}

export function getLocaleFromUrl(url: URL): Locale {
  // Match a whole first path segment, so /french-alps is not read as /fr.
  const segment = url.pathname.split('/')[1];
  if (segment === 'fr' || segment === 'en') {
    return segment;
  }
  return 'de';
}
