import deTrans from '~/content/i18n/de.json';
import frTrans from '~/content/i18n/fr.json';
import enTrans from '~/content/i18n/en.json';

export type Locale = 'de' | 'fr' | 'en';

const translations = {
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
