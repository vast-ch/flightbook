#!/usr/bin/env bash
# Change-detection check: runs the suite against a *dev-mode* build of the
# working tree with Angular's exhaustive checkNoChanges on (the `e2e` build
# configuration → environment.e2e.ts). Any binding that changed without Angular
# being notified logs NG0100, and every test fails on console errors.
#
# Made for the zoneless / OnPush migration. Screenshots are skipped: compare.sh
# covers the look against the production build.
#
#   ./cd-check.sh              # build + run everything
#   ./cd-check.sh flows        # extra args go to `playwright test`
set -euo pipefail

E2E="$(cd "$(dirname "$0")" && pwd)"
APP="$(dirname "$E2E")"

echo "▶ building working tree (dev mode, checkNoChanges)"
(cd "$APP" && npx ng build --configuration e2e >/dev/null)

cd "$E2E"
./stack/up.sh >/dev/null
E2E_CD_CHECK=1 E2E_WWW="$E2E/out/cd-build/browser" npx playwright test "$@"
