import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

// The app under test is a *built* bundle (default: a `ng build --configuration
// development`, which keeps environment.ts → API on localhost:8282).
const www = path.resolve(process.env.E2E_WWW ?? '../dist/flightbook-instructor-app/browser');
const port = Number(process.env.E2E_PORT ?? 4400);

export default defineConfig({
  testDir: './tests',
  outputDir: './out/results',
  fullyParallel: false,
  workers: 1, // tests share one seeded school
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'out/report', open: 'never' }]],
  use: {
    baseURL: `http://localhost:${port}`,
    channel: 'chrome',
    locale: 'de-CH',
    timezoneId: 'Europe/Zurich',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `node serve.mjs "${www}" ${port}`,
    port,
    reuseExistingServer: false,
  },
});
