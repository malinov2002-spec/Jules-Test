#!/usr/bin/env bash
#
# Boot the Huginn development server (web + background jobs).
# Run ./setup.sh first. Override the port with PORT=4000 ./run.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="${HERE}/src"
PORT="${PORT:-3000}"

[ -f "${SRC}/Gemfile" ] || { echo "No checkout at ${SRC}; run ./setup.sh first." >&2; exit 1; }

cd "${SRC}"
command -v rbenv >/dev/null 2>&1 && eval "$(rbenv init - bash 2>/dev/null || true)"

# Foreman runs both the web (puma) and jobs (threaded worker) processes from
# the Procfile. Fall back to a plain web server if foreman is unavailable —
# note that background agents will NOT run in that mode.
if bundle exec foreman version >/dev/null 2>&1; then
  echo "[run] starting web + jobs via foreman on port ${PORT}"
  exec bundle exec foreman start
else
  echo "[run] foreman unavailable — starting web only on port ${PORT}"
  echo "[run] for background agents also run: bundle exec rails runner bin/threaded.rb"
  exec env PORT="${PORT}" bundle exec puma -C config/puma.rb
fi
