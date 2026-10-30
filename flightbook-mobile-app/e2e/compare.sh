#!/usr/bin/env bash
# Visual + functional regression check of the working tree against a base ref.
#
#   ./compare.sh            # baseline from main
#   ./compare.sh 62cc47a    # baseline from any commit/branch
#
# 1. builds the base ref in a temporary git worktree and records screenshot
#    baselines from it (playwright --update-snapshots),
# 2. builds the current working tree and runs the suite against those
#    baselines. Failures, with expected/actual/diff images, land in
#    out/results and the HTML report in out/report (`npm run report`).
set -euo pipefail

BASE_REF="${1:-main}"
E2E="$(cd "$(dirname "$0")" && pwd)"
APP="$(dirname "$E2E")"
REPO="$(git -C "$APP" rev-parse --show-toplevel)"
OUT="$E2E/out"
WORKTREE="$OUT/base-worktree"
BASE_WWW="$OUT/base-www"
mkdir -p "$OUT"

echo "▶ building base ref '$BASE_REF'"
git -C "$REPO" worktree remove --force "$WORKTREE" 2>/dev/null || true
git -C "$REPO" worktree add --detach "$WORKTREE" "$BASE_REF" >/dev/null
(
  cd "$WORKTREE/flightbook-mobile-app"
  npm ci --no-audit --no-fund >/dev/null
  npx ng build >/dev/null
)
rm -rf "$BASE_WWW"
cp -R "$WORKTREE/flightbook-mobile-app/www/browser" "$BASE_WWW"
git -C "$REPO" worktree remove --force "$WORKTREE"

echo "▶ building working tree"
(cd "$APP" && npx ng build >/dev/null)

cd "$E2E"
echo "▶ recording baselines from '$BASE_REF'"
./stack/up.sh >/dev/null
rm -rf __screenshots__
E2E_WWW="$BASE_WWW" npx playwright test --update-snapshots --reporter=dot || {
  echo "✘ the base ref itself fails the suite — fix the tests or pick another base"; exit 1;
}

echo "▶ testing working tree against '$BASE_REF'"
./stack/up.sh >/dev/null
npx playwright test
