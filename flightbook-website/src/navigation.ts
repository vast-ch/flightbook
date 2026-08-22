// Navigation data for Flightbook, built from the i18n tables per locale.

import { getTranslations, type Locale } from '~/utils/i18n';

const prefix = (locale: Locale) => (locale === 'de' ? '' : `/${locale}`);

export function getHeaderData(locale: Locale) {
  const t = getTranslations(locale);
  const p = prefix(locale);

  return {
    links: [
      { text: t.nav.features, href: `${p}/#premium` },
      { text: t.nav.pricing, href: `${p}/#angebot` },
      { text: t.nav.schools, href: `${p}/#schools` },
      { text: t.nav.tandem, href: `${p}/#tandem` },
      { text: t.nav.faq, href: `${p}/#faq` },
    ],
    login: {
      text: t.nav.login,
      links: [
        { text: t.nav.loginPilot, sub: t.nav.loginPilotSub, href: 'https://m.flightbook.ch', icon: 'wing' as const },
        {
          text: t.nav.loginSchool,
          sub: t.nav.loginSchoolSub,
          href: 'https://instructor.flightbook.ch',
          icon: 'cap' as const,
        },
      ],
    },
    action: { text: t.nav.register, href: 'https://m.flightbook.ch/register' },
  };
}

export function getFooterData(locale: Locale) {
  const t = getTranslations(locale);
  const p = prefix(locale);

  return {
    cta: { title: t.footer.ctaTitle, button: t.footer.ctaButton, href: 'https://m.flightbook.ch/register' },
    columns: [
      { title: t.footer.openSource, links: [{ text: t.footer.github, href: 'https://github.com/vast-ch/flightbook' }] },
      { title: t.footer.legal, links: [{ text: t.footer.privacy, href: `${p}/privacy-policy` }] },
    ],
  };
}
