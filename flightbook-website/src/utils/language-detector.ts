/**
 * Browser language detection and auto-redirect for Flightbook
 * Detects French browsers and redirects to /fr on first visit
 */

export function initLanguageDetection() {
  if (typeof window === 'undefined') return;

  try {
    const currentPath = window.location.pathname;
    const currentHash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);
    const langParam = searchParams.get('lang');
    const isFirstVisit = !localStorage.getItem('flightbook-visited');
    const storedLang = localStorage.getItem('flightbook-lang');

    // Handle legacy ?lang=fr query parameter
    if (langParam === 'fr' && !currentPath.startsWith('/fr')) {
      const targetPath = currentPath === '/' ? '/fr' : `/fr${currentPath}`;
      window.location.href = `${targetPath}${currentHash}`;
      return;
    }

    // Mark as visited
    if (isFirstVisit) {
      localStorage.setItem('flightbook-visited', 'true');
    }

    // Get browser language
    const browserLang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || 'de';
    const isFrenchBrowser = browserLang.toLowerCase().startsWith('fr');

    // Only auto-redirect on first visit to root page
    if (isFirstVisit && currentPath === '/' && isFrenchBrowser) {
      window.location.href = `/fr${currentHash}`;
      return;
    }

    // Respect stored preference if different from current page
    if (storedLang && !isFirstVisit) {
      const isOnFrenchPage = currentPath.startsWith('/fr');
      const shouldBeOnFrenchPage = storedLang === 'fr';

      if (isOnFrenchPage !== shouldBeOnFrenchPage) {
        if (shouldBeOnFrenchPage) {
          // Redirect to French version
          window.location.href = `/fr${currentHash}`;
        } else {
          // Redirect to German version
          window.location.href = `/${currentHash}`;
        }
      }
    }
  } catch (e) {
    console.warn('Language detection error:', e);
  }
}
