# Huginn — local setup (prep)

[Huginn](https://github.com/huginn/huginn) is a Ruby on Rails app for building
agents that monitor the web and act on your behalf. This directory prepares a
**from-source, PostgreSQL** install but does not build or boot it — run the
scripts below on a machine where the result can persist.

## Why source instead of Docker

Huginn normally runs from its official Docker image. In the environment where
this was prepared, **all container-image pulls were blocked** by the network
policy (registry blob CDNs returned `403`), so Docker was not an option. The
from-source path below uses a local PostgreSQL instead.

## Prerequisites

- **Ruby >= 3.4.0** (`setup.sh` installs it via `rbenv` if present)
- **PostgreSQL** running and reachable (defaults to `127.0.0.1:5432`)
- Build tools for native gems (`build-essential`, `libpq-dev`, `libssl-dev`,
  `libxml2-dev`, `libxslt1-dev`), plus `node` for asset compilation

## Usage

```bash
cd huginn
./setup.sh     # clone (if needed) + Ruby + .env + gems + DB + migrate
./run.sh       # boot web + background jobs, then open http://localhost:3000
```

After seeding, log in with **admin / password** and change it immediately.

Override defaults with environment variables:

```bash
RUBY_VERSION=3.4.9 DB_USER=huginn DB_PASSWORD=secret PORT=4000 ./setup.sh
```

## What's here

| File | Purpose |
|------|---------|
| `setup.sh` | Idempotent installer: clone → Ruby → `.env` → `bundle` → DB → migrate |
| `run.sh` | Boots web (puma) + jobs (threaded worker) via foreman |
| `huginn.env.template` | Reference PostgreSQL overrides applied to `./src/.env` |
| `src/` | The Huginn checkout — git-ignored (large, reproducible, holds a secret) |

## Notes

- `setup.sh` generates a fresh `APP_SECRET_TOKEN`; the real `.env` is never
  committed (`src/` is git-ignored).
- The PostgreSQL role is created with `CREATEDB` so `rake db:create` works.
  If your server uses different superuser credentials, set `PSQL_SUPER`, e.g.
  `PSQL_SUPER="psql -U myadmin -h db.host"`.
- Background agents only run when the `jobs` process is up (foreman handles
  this); a web-only fallback will not schedule agents.
