/**
 * screenshot.config.js
 *
 * Edit this file to match your app's routes and the screens you want
 * captured. No native testing, no simulator needed — Playwright renders
 * your Angular/Ionic app in a real headless Chrome browser at the exact
 * pixel dimensions each store requires.
 */

module.exports = {
  // Where your Ionic app is being served. Use `ionic serve` (dev server)
  // or serve the built `www/` folder, e.g.:
  //   npx http-server www -p 8100
  baseUrl: "http://localhost:8100",

  // Home redirects to /login when there's no valid session, so the script
  // logs in once (reusing the resulting session across every device) before
  // capturing any route. Credentials come from the environment — never
  // commit them here. Set auth to null to skip the login step entirely
  // (e.g. if you're only capturing public routes).
  auth: {
    loginPath: "/login",
    email: process.env.SCREENSHOT_EMAIL,
    password: process.env.SCREENSHOT_PASSWORD,
    // ion-input renders its native <input> inside shadow DOM, so target it
    // through the host element rather than the host's own id/name.
    emailSelector: "#loginEmail input",
    passwordSelector: "#loginPassword input",
    submitSelector: "#loginForm ion-button[type='submit']",
  },

  // Each entry becomes one screenshot filename per device size.
  // `path` is appended to baseUrl. `waitFor` is an optional CSS selector
  // the script will wait for before taking the shot, for routes whose
  // async data isn't already covered by the generic skeleton-loader wait
  // (see waitForDataLoaded in generate_screenshots.js).
  routes: [
    { name: "01_home", path: "/home" },
    { name: "02_flights", path: "/flights" },
    { name: "03_flight-detail", path: "/flights/139056" },
    { name: "04_statistics", path: "/statistics" },
    { name: "05_school", path: "/school/1" },
    { name: "06_control-sheet", path: "/control-sheet" },
  ],

  // Device targets. viewport (CSS px) x deviceScaleFactor multiplies out
  // to the EXACT pixel dimensions each store requires — chosen to match
  // real device proportions, so your UI renders at the same relative
  // size a real screenshot would show (not stretched or shrunk).
  devices: [
    {
      store: "ios",
      label: "iphone_6.9",       // covers 6.5"/6.3"/6.1" via Apple's auto-scaling
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 3,       // -> 1290x2796
    },
    {
      store: "ios",
      label: "ipad_13",          // covers 12.9"/11" via Apple's auto-scaling
      viewport: { width: 1032, height: 1376 },
      deviceScaleFactor: 2,       // -> 2064x2752
    },
    // Uncomment if your app still supports iPhone 8 Plus-era devices:
    // {
    //   store: "ios",
    //   label: "iphone_5.5",
    //   viewport: { width: 414, height: 736 },
    //   deviceScaleFactor: 3,     // -> 1242x2208
    // },
    {
      store: "android",
      label: "phone",             // well within Play Store's 320-3840px bounds
      viewport: { width: 360, height: 640 },
      deviceScaleFactor: 3,       // -> 1080x1920
    },
    // Uncomment for an Android tablet screenshot:
    {
      store: "android",
      label: "tablet",
      viewport: { width: 800, height: 1280 },
      deviceScaleFactor: 2,     // -> 1600x2560
    },
  ],

  outputDir: ".",

  // Extra settle time (ms) after navigation and data-loaded detection —
  // useful for Ionic page transition/enter animations to finish.
  settleDelayMs: 400,
};
