import deTrans from '~/content/i18n/de.json';
import frTrans from '~/content/i18n/fr.json';

export type Locale = 'de' | 'fr';

const translations = {
  de: deTrans,
  fr: frTrans,
};

export function getTranslations(locale: Locale) {
  return translations[locale] || translations.de;
}

export function getLocaleFromUrl(url: URL): Locale {
  const pathname = url.pathname;
  if (pathname.startsWith('/fr')) {
    return 'fr';
  }
  return 'de';
}
