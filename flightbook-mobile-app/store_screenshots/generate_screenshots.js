#!/usr/bin/env node
/**
 * generate_screenshots.js
 *
 * Captures App Store and Play Store screenshots directly from your
 * running Angular/Ionic/Capacitor web app using headless Chrome —
 * no simulator, no native UI tests, no post-hoc cropping.
 *
 * SETUP
 * -----
 *   npm install -D playwright
 *   npx playwright install chromium
 *
 * USAGE
 * -----
 *   1. Start your app:            ionic serve
 *      (or serve a production build: npx http-server www -p 8100)
 *   2. Edit screenshot.config.js  (routes, baseUrl, devices, auth)
 *   3. Provide test credentials:  SCREENSHOT_EMAIL=... SCREENSHOT_PASSWORD=...
 *   4. Run:                       node generate_screenshots.js
 *
 * OUTPUT
 * ------
 *   screenshots/ios/iphone_6.9/01_home.png   (1290x2796)
 *   screenshots/ios/ipad_13/01_home.png      (2064x2752)
 *   screenshots/android/phone/01_home.png    (1080x1920)
 *   ...one subfolder per device target, one file per route.
 */

const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");
const config = require("./screenshot.config.js");

// Home (and most other authenticated routes) redirect to /login when
// there's no valid session, so we log in once and reuse the resulting
// storage state (access_token/refresh_token in localStorage) across every
// device context instead of re-authenticating per device.
async function login(browser) {
  const { auth, baseUrl } = config;
  if (!auth.email || !auth.password) {
    throw new Error(
      "screenshot.config.js has an `auth` block but SCREENSHOT_EMAIL / " +
        "SCREENSHOT_PASSWORD are not set. Export them before running, or " +
        "set `auth: null` in screenshot.config.js to skip login."
    );
  }

  const context = await browser.newContext();
  const page = await context.newPage();
  const loginUrl = baseUrl.replace(/\/$/, "") + auth.loginPath;

  console.log(`Logging in as ${auth.email} ...`);
  await page.goto(loginUrl, { waitUntil: "networkidle" });
  await page.locator(auth.emailSelector).fill(auth.email);
  await page.locator(auth.passwordSelector).fill(auth.password);

  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes(auth.loginPath), {
      timeout: 15000,
    }),
    page.locator(auth.submitSelector).click(),
  ]);

  const storageState = await context.storageState();
  await context.close();
  console.log("Logged in.\n");
  return storageState;
}

// Ionic pages show <ion-skeleton-text> placeholders while their data
// loads. Rather than hardcoding a per-route selector, wait for any
// skeleton on the page to appear and then disappear — this covers new
// routes automatically. Routes that load faster than we can observe the
// skeleton, or that have no skeleton at all, just fall through.
async function waitForDataLoaded(page) {
  try {
    await page.waitForSelector("ion-skeleton-text", {
      state: "attached",
      timeout: 2000,
    });
    await page.waitForSelector("ion-skeleton-text", {
      state: "detached",
      timeout: 15000,
    });
  } catch {
    // No skeleton ever showed up (already loaded, or route has none) —
    // that's fine, we just move on.
  }
}

async function main() {
  const browser = await chromium.launch();
  const storageState = config.auth ? await login(browser) : undefined;

  for (const device of config.devices) {
    const outDir = path.join(config.outputDir, device.store, device.label);
    fs.mkdirSync(outDir, { recursive: true });

    const context = await browser.newContext({
      viewport: device.viewport,
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
      storageState,
    });
    const page = await context.newPage();

    const outW = device.viewport.width * device.deviceScaleFactor;
    const outH = device.viewport.height * device.deviceScaleFactor;
    console.log(
      `\n[${device.store}/${device.label}]  ${outW}x${outH}  (viewport ${device.viewport.width}x${device.viewport.height} @${device.deviceScaleFactor}x)`
    );

    for (const route of config.routes) {
      const url = config.baseUrl.replace(/\/$/, "") + route.path;
      const outPath = path.join(outDir, `${route.name}.png`);

      await page.goto(url, { waitUntil: "networkidle" });

      await waitForDataLoaded(page);
      if (route.waitFor) {
        await page.waitForSelector(route.waitFor, { timeout: 10000 });
      }
      if (config.settleDelayMs) {
        await page.waitForTimeout(config.settleDelayMs);
      }

      await page.screenshot({ path: outPath }); // viewport only, not full page
      console.log(`  ${route.name} -> ${outPath}`);
    }

    await context.close();
  }

  await browser.close();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
