import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

// The app under test is a *built* bundle (default: ../www/browser from a bare
// `ng build`, which bakes in environment.ts → API on localhost:8282).
// compare.sh points E2E_WWW at a build of the base ref to record baselines.
const www = path.resolve(process.env.E2E_WWW ?? '../www/browser');
const port = Number(process.env.E2E_PORT ?? 4300);

export default defineConfig({
  testDir: './tests',
  outputDir: './out/results',
  snapshotPathTemplate: '__screenshots__/{projectName}/{arg}{ext}',
  fullyParallel: false,
  workers: 1, // tests share one seeded user
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'out/report', open: 'never' }]],
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.001,
      animations: 'disabled',
      caret: 'hide',
      stylePath: './screenshot.css',
    },
  },
  use: {
    baseURL: `http://localhost:${port}`,
    channel: 'chrome',
    locale: 'en-US',
    timezoneId: 'Europe/Zurich',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [
    // Full-screen size: the app runs edge to edge in Capacitor, so the preset's
    // Safari *visible* area (minus browser toolbars) would be too short.
    // 390×844 pt @3x = 1170×2532 px, the real iPhone 16e screen.
    // The preset defaults to WebKit; Chrome with an iPhone UA still puts Ionic
    // in iOS mode, which is what the screenshots are about.
    // Flows mutate data but clean up after themselves, and with one worker
    // nothing runs concurrently with them.
    { name: 'iphone-16e', use: { ...devices['iPhone 16e'], browserName: 'chromium', viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `node serve.mjs "${www}" ${port}`,
    port,
    reuseExistingServer: false,
  },
});
