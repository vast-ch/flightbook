#!/usr/bin/env bash
# Stops the API started by up.sh and removes the e2e Postgres container.
HERE="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$HERE/../out/api.pid"
if [ -f "$PID_FILE" ]; then
  kill "$(cat "$PID_FILE")" 2>/dev/null || true
  rm -f "$PID_FILE"
fi
docker rm -f fb-e2e-pg >/dev/null 2>&1 || true
echo "✓ stack is down"
