import informations from '../../package.json';

// Dev-mode build for the e2e change-detection check (`npm run test:cd` in e2e/).
// Same API as environment.ts; additionally turns on Angular's exhaustive
// checkNoChanges, so a binding that changed without Angular being told about it
// logs NG0100 to the console, where the e2e suite fails on it.
export const environment = {
  production: false,
  baseUrl: 'http://localhost:8282',
  appVersion: informations.version,
  checkNoChanges: true,
};
