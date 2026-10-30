// Navigation data for Flightbook

export const headerData = {
  links: [
    {
      text: 'Angebot',
      href: '/#angebot',
    },
    {
      text: 'Flightbook Premium',
      href: '/#premium',
    },
    {
      text: 'Flightbook Schools',
      href: '/#schools',
    },
    {
      text: 'Login',
      href: 'https://m.flightbook.ch',
      target: '_blank',
    },
    {
      text: 'Login Fluglehrer',
      href: 'https://instructor.flightbook.ch',
      target: '_blank',
    },
  ],
  actions: [
    {
      text: 'Registrieren',
      href: 'https://m.flightbook.ch/register',
      target: '_blank',
      variant: 'primary' as const,
    },
  ],
};

export const headerDataFr = {
  links: [
    {
      text: 'Offre',
      href: '/fr#angebot',
    },
    {
      text: 'Flightbook Premium',
      href: '/fr#premium',
    },
    {
      text: 'Flightbook Écoles',
      href: '/fr#schools',
    },
    {
      text: 'Connexion',
      href: 'https://m.flightbook.ch',
      target: '_blank',
    },
    {
      text: 'Connexion Instructeur',
      href: 'https://instructor.flightbook.ch',
      target: '_blank',
    },
  ],
  actions: [
    {
      text: "S'inscrire",
      href: 'https://m.flightbook.ch/register',
      target: '_blank',
      variant: 'primary' as const,
    },
  ],
};

export const footerData = {
  links: [
    {
      title: 'Legal',
      links: [
        { text: 'Datenschutz', href: '/privacy-policy' },
      ],
    },
  ],
  secondaryLinks: [],
  socialLinks: [],
};

export const footerDataFr = {
  links: [
    {
      title: 'Légal',
      links: [
        { text: 'Confidentialité', href: '/fr/privacy-policy' },
      ],
    },
  ],
  secondaryLinks: [],
  socialLinks: [],
};
