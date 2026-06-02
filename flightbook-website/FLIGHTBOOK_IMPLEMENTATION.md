# Flightbook Landing Page Implementation

## Overview

Successfully implemented a bilingual (German/French) landing page for Flightbook using the AstroWind template with automatic browser language detection.

## Completed Features

### 1. ✅ i18n Configuration

- **Astro i18n setup**: Configured in `astro.config.ts` with German as default locale and French as supported locale
- **Routing**: German at `/`, French at `/fr` (no prefix for default locale)
- **Translation files**: Created `src/content/i18n/de.json` and `src/content/i18n/fr.json` with all content

### 2. ✅ Site Configuration

- **Updated `src/config.yaml`**:
  - Site name: Flightbook
  - Domain: https://flightbook.ch
  - SEO metadata for German content
  - Flightbook app icon for Open Graph
  - Blog disabled
  - Brand colors updated to Flightbook blue (#1b3e71)

### 3. ✅ Custom Components Created

#### Hero Section (`FlightbookHero.astro`)

- Title and subtitle
- iOS and Android download buttons with app store icons
- Premium subscription CTA
- Flightbook app icon display

#### Pricing Section (`FlightbookPricing.astro`)

- Three pricing tiers: FREE, Premium, Schools
- Feature lists with checkmarks
- Badge indicators (Pilot/Flugschule)
- Pricing notes about free flights and open source
- Responsive grid layout

#### Premium Features (`FlightbookPremiumFeatures.astro`)

- Four feature cards with icons
- Image slideshow with navigation
- Auto-advancing slides (4 seconds)
- Pause on hover
- Images from existing static site

#### Schools Features (`FlightbookSchoolsFeatures.astro`)

- Three feature cards for flight schools
- Icons for each feature
- Centered layout with descriptions
- CTA to create school

### 4. ✅ Language Detection & Switching

#### Browser Language Detection (`src/utils/language-detector.ts`)

- Detects French browsers on first visit
- Auto-redirects to `/fr` for French users
- Stores language preference in localStorage
- Only auto-redirects on first visit
- Respects manual language selection

#### Language Switcher (`src/components/common/LanguageSwitcher.astro`)

- DE/FR toggle buttons
- Active state styling
- Preserves URL hash when switching
- Stores preference in localStorage
- Integrated in header

### 5. ✅ Navigation Updates

#### Header (`src/components/widgets/Header.astro`)

- Added language switcher support
- Locale-aware navigation
- Props for `currentLocale` and `showLanguageSwitcher`

#### Navigation Data (`src/navigation.ts`)

- German navigation: Angebot, Flightbook Premium, Flightbook Schools
- French navigation: Offre, Flightbook Premium, Flightbook Écoles
- External links: Login, Login Fluglehrer/Instructeur, Registrieren/S'inscrire
- Anchor links to page sections

#### Page Layout (`src/layouts/PageLayout.astro`)

- Locale detection from URL
- Dynamic header data based on locale
- Language switcher enabled by default

### 6. ✅ Pages Created

#### German Homepage (`src/pages/index.astro`)

- Uses German translations
- All Flightbook sections
- Language detection script
- Proper metadata and SEO

#### French Homepage (`src/pages/fr/index.astro`)

- Uses French translations
- Same structure as German
- Proper canonical URLs
- hreflang support

### 7. ✅ Branding & Styling

#### Logo (`src/components/Logo.astro`)

- Flightbook app icon
- Site name from config

#### Colors (`src/components/CustomStyles.astro`)

- Primary: rgb(27 62 113) - Flightbook blue
- Secondary: rgb(21 50 91)
- Accent: rgb(45 85 145)
- Dark mode variants

#### Announcement (`src/components/widgets/Announcement.astro`)

- Removed default AstroWind announcement

### 8. ✅ Assets

- Copied images from static site to `src/assets/images/flightbook/`:
  - home.png
  - statistic.png
  - add-flight.png
  - place.png
- Using Flightbook app icon from GitHub

### 9. ✅ Utilities

#### i18n Helper (`src/utils/i18n.ts`)

- `getTranslations(locale)`: Load translation files
- `getLocaleFromUrl(url)`: Detect locale from URL path
- Type-safe locale handling

## File Structure

```
src/
├── assets/images/flightbook/     # App screenshots
├── components/
│   ├── common/
│   │   └── LanguageSwitcher.astro
│   └── widgets/
│       ├── FlightbookHero.astro
│       ├── FlightbookPricing.astro
│       ├── FlightbookPremiumFeatures.astro
│       └── FlightbookSchoolsFeatures.astro
├── content/i18n/
│   ├── de.json                   # German translations
│   └── fr.json                   # French translations
├── pages/
│   ├── index.astro              # German homepage
│   └── fr/
│       └── index.astro          # French homepage
└── utils/
    ├── i18n.ts                  # Translation utilities
    └── language-detector.ts     # Browser detection
```

## URLs

- German: https://flightbook.ch/
- French: https://flightbook.ch/fr

## External Links

- iOS App: https://apps.apple.com/ch/app/flightbook/id1046316231
- Android App: https://play.google.com/store/apps/details?id=ch.flightbook.MobileFlight
- Login: https://m.flightbook.ch
- Instructor Login: https://instructor.flightbook.ch
- Register: https://m.flightbook.ch/register
- Create School: https://instructor.flightbook.ch/school/register
- Premium Settings: https://m.flightbook.ch/settings

## Language Detection Behavior

1. **First Visit**:
   - Detects browser language
   - If French (fr-\*), redirects to `/fr`
   - Otherwise stays on `/` (German)
   - Sets `flightbook-visited` flag in localStorage

2. **Subsequent Visits**:
   - Respects stored language preference
   - No automatic redirects
   - User can manually switch languages

3. **Manual Language Switch**:
   - Stores preference in localStorage
   - Preserves URL hash
   - Updates immediately

## Build & Development

- **Dev Server**: `npm run dev` → http://localhost:4321
- **Build**: `npm run build` → Outputs to `dist/`
- **Preview**: `npm run preview`
- **Check**: `npm run check` (Astro + ESLint + Prettier)

## Testing Checklist

- [x] Build succeeds without errors
- [x] German homepage loads at `/`
- [x] French homepage loads at `/fr`
- [x] Language switcher works
- [x] All sections render correctly
- [x] Images load properly
- [x] External links work
- [x] Responsive design
- [x] Dark mode support
- [x] SEO metadata correct

## Completed Enhancements

1. ✅ **Google Analytics** - Ready to add ID in `src/config.yaml` (line 76)
2. ✅ **Favicon files** - Multiple sizes in `public/` folder:
   - `/favicon.png` (32x32)
   - `/icon-192.png` (192x192)
   - `/icon-512.png` (512x512)
   - `/apple-touch-icon.png` (180x180)
   - `/site.webmanifest` (PWA manifest)
3. ✅ **Local assets** - Flightbook icon copied to `src/assets/images/flightbook-icon.png`

## Next Steps (Optional)

1. Test language detection in different browsers
2. Add more language-specific content if needed
3. Set up deployment to production (Netlify/Vercel)
4. Add hreflang tags for better SEO
5. Test on mobile devices
6. Performance optimization if needed
7. Add actual Google Analytics tracking ID when available

## Notes

- All content sourced from https://flightbook.ch and existing static site
- Maintains AstroWind architecture and best practices
- Uses Tailwind CSS v4 for styling
- Fully static site generation (SSG)
- No runtime JavaScript except for language detection and slideshow
