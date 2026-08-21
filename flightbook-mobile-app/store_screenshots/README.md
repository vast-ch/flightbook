# How to use: automated store screenshots for your Ionic/Capacitor app

This generates pixel-exact App Store and Play Store screenshots straight
from your Angular/Ionic app, using headless Chrome — no simulator, no
native UI tests, no manual resizing.

Files involved:
- `generate_screenshots.js` — the script that does the work
- `screenshot.config.js` — where you tell it which screens and sizes to capture

---

## 1. Install the tools (one-time)

From your Ionic project's root folder:

```bash
npm install -D playwright
npx playwright install chromium
```

Put `generate_screenshots.js` and `screenshot.config.js` in that same
project root (next to `package.json`).

---

## 2. Start your app

In a terminal, start the dev server and **leave it running**:

```bash
ionic serve
```

By default this serves at `http://localhost:8100`. Note the URL it
prints — you'll need it in the config if it's different (e.g. a
different port).

If you'd rather capture a production build instead of the dev server:

```bash
ionic build
npx http-server www -p 8100
```

---

## 3. Edit `screenshot.config.js`

Open the file and update three things:

**`baseUrl`** — match whatever `ionic serve` printed:
```js
baseUrl: "http://localhost:8100",
```

**`routes`** — list the screens you want screenshotted, using your
Angular router paths:
```js
routes: [
  { name: "01_home", path: "/home" },
  { name: "02_details", path: "/details/123" },
  { name: "03_profile", path: "/profile" },
],
```
- `name` becomes the output filename.
- `path` is appended to `baseUrl`.
- If a screen loads data asynchronously and you don't want to catch it
  mid-spinner, add `waitFor: ".some-css-selector"` that only appears
  once the real content is loaded.

**`devices`** — leave as-is unless you need extra sizes. By default
it captures:
- iOS: `iphone_6.9` (1290×2796) and `ipad_13` (2064×2752) — Apple
  auto-scales these down for all other iPhone/iPad sizes
- Android: `phone` (1080×1920) — well within Play Store's requirements

To add the legacy iPhone 5.5" size or an Android tablet size, uncomment
the relevant blocks in the file (they're already written, just commented out).

---

## 4. Handle screens that need you to be logged in / have data

The script just loads a URL — it doesn't click through a login flow.
For screens behind auth or with real data (a populated cart, a user
dashboard), do one of:
- Seed your dev environment with test data so those routes render
  something real when loaded directly
- Add a query param or dev-only route your app checks to render the
  screen in a realistic "logged in" state without a real auth flow
  (e.g. `/profile?mockUser=1`)

---

## 5. Run it

With `ionic serve` still running in its own terminal, in a second
terminal run:

```bash
SCREENSHOT_EMAIL="email" SCREENSHOT_PASSWORD="Password" node generate_screenshots.js
```

You'll see progress printed for each device size and route:

```
[ios/iphone_6.9]  1290x2796  (viewport 430x932 @3x)
  01_home -> screenshots/ios/iphone_6.9/01_home.png
  02_details -> screenshots/ios/iphone_6.9/02_details.png
  03_profile -> screenshots/ios/iphone_6.9/03_profile.png

[ios/ipad_13]  2064x2752  (viewport 1032x1376 @2x)
  ...

[android/phone]  1080x1920  (viewport 360x640 @3x)
  ...

Done.
```

---

## 6. Find your screenshots

They land in:

```
screenshots/
  ios/
    iphone_6.9/   01_home.png  02_details.png  03_profile.png
    ipad_13/      01_home.png  02_details.png  03_profile.png
  android/
    phone/        01_home.png  02_details.png  03_profile.png
```

- **iOS**: upload the `iphone_6.9` set as your 6.9" screenshots and
  the `ipad_13` set as your 12.9"/13" screenshots in App Store Connect.
  Apple auto-generates the smaller iPhone/iPad sizes from these.
- **Android**: upload the `phone` set directly in Play Console as your
  phone screenshots — no resizing needed, they're already within spec.

---

## Troubleshooting

**Screenshot shows a blank or loading page**
Increase `settleDelayMs` in the config, or add a `waitFor` selector
for that specific route so the script waits for real content.

**"net::ERR_CONNECTION_REFUSED"**
`ionic serve` isn't running, or `baseUrl` in the config doesn't match
the port it's using. Check the terminal running `ionic serve` for the
actual address.

**A route needs login and you don't have a mock state for it**
Skip it in `routes` for now and capture it manually as a one-off, or
add the dev-only mock-state route described in step 4.

**Want device frames (bezel, status bar, marketing text) around these**
That's a separate, optional step using `frameit` (part of fastlane,
also free) — ask if you'd like that added on top of this output.
