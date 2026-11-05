#!/usr/bin/env bash
# Starts a throwaway Postgres (Docker) and flightbook-api on :8282, then seeds
# a test user with places, gliders and flights. Safe to re-run: the database
# container is recreated each time, so every run starts from the same data.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
E2E="$(dirname "$HERE")"
API="$(cd "$E2E/../../flightbook-api" && pwd)"
OUT="$E2E/out"
mkdir -p "$OUT"

"$HERE/down.sh" >/dev/null 2>&1 || true

echo "› postgres"
docker run -d --name fb-e2e-pg --platform linux/amd64 \
  -e POSTGRES_USER=fb -e POSTGRES_PASSWORD=fb -e POSTGRES_DB=flightbook_test \
  -p 55432:5432 \
  -v "$API/test/init-schema.sql:/docker-entrypoint-initdb.d/init.sql:ro" \
  postgis/postgis:15-3.4 >/dev/null
until docker logs fb-e2e-pg 2>&1 | grep -q "PostgreSQL init process complete"; do sleep 1; done
until docker exec fb-e2e-pg pg_isready -U fb -d flightbook_test >/dev/null 2>&1; do sleep 1; done

echo "› api (log: out/api.log)"
[ -d "$API/node_modules" ] || (cd "$API" && npm ci --no-audit --no-fund)
(cd "$API" && npx nest build)
(
  cd "$API"
  # shellcheck source=/dev/null
  source "$HERE/api.env"
  nohup node dist/main >"$OUT/api.log" 2>&1 &
  echo $! >"$OUT/api.pid"
)
for _ in $(seq 1 60); do
  grep -q "successfully started" "$OUT/api.log" 2>/dev/null && break
  if ! kill -0 "$(cat "$OUT/api.pid")" 2>/dev/null; then
    echo "API exited during startup:"; tail -20 "$OUT/api.log"; exit 1
  fi
  sleep 1
done
grep -q "successfully started" "$OUT/api.log" || { echo "API did not start in 60s"; tail -20 "$OUT/api.log"; exit 1; }

echo "› seed"
node "$HERE/seed.mjs"
echo "✓ stack is up — API on http://localhost:8282"
