#!/usr/bin/env bash
#
# Huginn from-source setup (PostgreSQL).
#
# Prepares a runnable Huginn development checkout:
#   1. clones huginn into ./src (if absent)
#   2. ensures Ruby >= 3.4 via rbenv
#   3. writes ./src/.env configured for a local PostgreSQL
#   4. bundle install
#   5. creates the PostgreSQL role + database
#   6. runs db:create / db:migrate / db:seed
#
# Idempotent: safe to re-run. Run ./run.sh afterwards to boot the server.
#
# Override defaults via environment variables, e.g.:
#   RUBY_VERSION=3.4.9 DB_PASSWORD=secret ./setup.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="${HERE}/src"

RUBY_VERSION="${RUBY_VERSION:-3.4.9}"
HUGINN_REPO="${HUGINN_REPO:-https://github.com/huginn/huginn}"

DB_NAME="${DB_NAME:-huginn_development}"
DB_USER="${DB_USER:-huginn}"
DB_PASSWORD="${DB_PASSWORD:-huginn}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"

log() { printf '\033[0;32m[setup]\033[0m %s\n' "$1"; }
die() { printf '\033[0;31m[setup] ERROR:\033[0m %s\n' "$1" >&2; exit 1; }

# --- 1. clone -------------------------------------------------------------
if [ ! -e "${SRC}/Gemfile" ]; then
  log "Cloning Huginn into ${SRC}"
  git clone --depth 1 "${HUGINN_REPO}" "${SRC}"
else
  log "Huginn source already present at ${SRC}"
fi

# --- 2. ruby --------------------------------------------------------------
if command -v rbenv >/dev/null 2>&1; then
  log "Ensuring Ruby ${RUBY_VERSION} via rbenv"
  rbenv install -s "${RUBY_VERSION}"
  ( cd "${SRC}" && rbenv local "${RUBY_VERSION}" )
  eval "$(rbenv init - bash 2>/dev/null || true)"
else
  log "rbenv not found; using system ruby ($(ruby -v 2>/dev/null || echo none))"
  log "Huginn requires Ruby >= 3.4.0 — install it yourself if the system ruby is older."
fi

# --- 3. .env --------------------------------------------------------------
cd "${SRC}"
if [ ! -f .env ]; then
  log "Writing .env (PostgreSQL)"
  cp .env.example .env
  sed -i \
    -e 's/^DATABASE_ADAPTER=.*/DATABASE_ADAPTER=postgresql/' \
    -e 's/^DATABASE_ENCODING=.*/DATABASE_ENCODING=unicode/' \
    -e "s/^DATABASE_NAME=.*/DATABASE_NAME=${DB_NAME}/" \
    -e "s/^DATABASE_USERNAME=.*/DATABASE_USERNAME=${DB_USER}/" \
    -e "s/^DATABASE_PASSWORD=.*/DATABASE_PASSWORD=\"${DB_PASSWORD}\"/" \
    -e "s/^#DATABASE_HOST=.*/DATABASE_HOST=${DB_HOST}/" \
    -e "s/^#DATABASE_PORT=.*/DATABASE_PORT=${DB_PORT}/" \
    .env
  SECRET="$(openssl rand -hex 64)"
  sed -i "s/^APP_SECRET_TOKEN=.*/APP_SECRET_TOKEN=${SECRET}/" .env
else
  log ".env already exists — leaving it untouched"
fi

# --- 4. gems --------------------------------------------------------------
log "Installing gems (bundle install)"
gem install bundler --conservative >/dev/null
bundle config set --local without 'production' >/dev/null 2>&1 || true
DATABASE_ADAPTER=postgresql bundle install

# --- 5. postgres role + db ------------------------------------------------
log "Ensuring PostgreSQL role '${DB_USER}' and database '${DB_NAME}'"
if command -v psql >/dev/null 2>&1; then
  # Create role if missing (requires a superuser connection; adjust as needed).
  PSQL_SUPER="${PSQL_SUPER:-psql -v ON_ERROR_STOP=1 -h ${DB_HOST} -p ${DB_PORT} -U postgres}"
  ${PSQL_SUPER} -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" 2>/dev/null \
    | grep -q 1 \
    || ${PSQL_SUPER} -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}' CREATEDB;" \
    || log "Could not auto-create role — create it manually if db:create fails."
else
  die "psql not found — install PostgreSQL or point DB_HOST at a running server."
fi

# --- 6. migrate -----------------------------------------------------------
log "Creating and migrating the database"
RAILS_ENV=development bundle exec rake db:create
RAILS_ENV=development bundle exec rake db:migrate
RAILS_ENV=development bundle exec rake db:seed || log "db:seed skipped/failed (non-fatal)"

log "Done. Boot the app with: ${HERE}/run.sh"
log "Default login after seeding: username 'admin' / password 'password'"
