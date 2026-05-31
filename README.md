FoosballUnity
=============

Frontend (React 19 + TypeScript + Vite) for the foosball / table soccer tournament organizer. This repo also hosts the `docker-compose.yml` that orchestrates the full stack (frontend + backend + database).

The backend lives in a sibling repo:

```
git clone https://github.com/nlkolbe/TableSoccerREST.git ../TableSoccerREST
```

Layout expected by `docker-compose.yml`:

```
parent-folder/
├── FoosballUnity/      # this repo (run compose from here)
│   └── docker-compose.yml
└── TableSoccerREST/    # sibling — backend + db-init scripts
    └── db-init/        # mounted into MariaDB on first start
```

Services
--------

| Service   | Image                       | Port  | Notes                                                            |
|-----------|-----------------------------|-------|------------------------------------------------------------------|
| mariadb   | `mariadb:10.11`             | 3306  | DB `nykreditfoosballunity`, user `football` (no pw)              |
| backend   | `eclipse-temurin:11-jdk`    | 5050  | Runs `./gradlew run`. Dev: bind-mounts source. Prod: built image.|
| frontend  | `node:20-alpine` (dev)      | 4200  | Vite dev server against bind-mounted source                      |
| frontend  | `nginx:alpine` (prod)       | 8080  | Static `dist/` served by nginx, port set by `FRONTEND_PORT`      |

Quick start
-----------

```
./scripts/init-env.sh                       # creates .env from .env.example (no-op if present)
podman compose up -d                        # dev: Vite on http://localhost:4200
```

First boot pulls images and downloads Gradle + npm deps; expect a couple of minutes. Subsequent starts are seconds because the gradle cache and `node_modules` are persisted.

Run from registry
-----------------

For a pure-image run with no source checkout of either repo, use `docker-compose.registry.yml`. It pulls backend and frontend from GHCR (`ghcr.io/thaestrup/tablesoccerrest` and `ghcr.io/thaestrup/foosballunity`) and brings up MariaDB alongside.

```
podman compose -f docker-compose.registry.yml up -d
# frontend on http://localhost:${FRONTEND_PORT:-8080}, backend on :5051
```

Pin a specific version with `TAG`, e.g. `TAG=v1.0.0 podman compose -f docker-compose.registry.yml up -d` (defaults to `latest`).

While the GHCR packages are private you'll need to authenticate first:

```
podman login ghcr.io        # username = your GitHub handle, password = a PAT with read:packages
```

Once the packages are flipped to public, the `login` step is no longer required.

### Release flow

Images are built and pushed by `.github/workflows/docker-publish.yml` on any `v*` tag. To cut a release:

```
git tag v1.0.0
git push origin v1.0.0
```

The workflow publishes `ghcr.io/thaestrup/foosballunity:1.0.0` (plus `1.0`, `1`, and `latest`). The backend repo (`TableSoccerREST`) has a matching workflow — tag both repos together to keep versions aligned.

Production-style run
--------------------

```
./scripts/init-env.sh                       # if you haven't already
podman compose down                         # stop dev first if it's running
podman compose -f docker-compose.prod.yml up -d --build
# frontend on http://localhost:${FRONTEND_PORT:-8080}, backend on :5050
```

The prod compose builds the React app with `VITE_BACKEND_URL` baked in, serves the static bundle via nginx (SPA fallback + 1-year cache on `/assets/*`), and brings up backend + db without source bind-mounts. Both stacks use host networking on this machine (no `tun` module → no rootless bridge), so they share host ports and **only one stack runs at a time**. Switch back with `podman compose -f docker-compose.prod.yml down` then `podman compose up -d`.

Configuration (.env)
--------------------

`scripts/init-env.sh` copies `.env.example` to `.env` on first run and leaves an existing `.env` untouched. Variables:

- `VITE_BACKEND_URL` — backend URL the React app calls. Dev reads it at runtime; prod bakes it into the bundle at build time, so a change requires `--build`.
- `FRONTEND_PORT` — host port nginx listens on in prod (default `8080`). Use `>=1024` since rootless containers can't bind privileged ports.

Common commands
---------------

```
podman compose up -d                        # start dev stack
podman compose down                         # stop, keep data
podman compose down -v                      # stop and wipe DB + gradle cache
podman compose logs -f backend              # tail one service
podman compose restart backend              # restart one service
podman compose -f docker-compose.prod.yml up -d --build   # prod stack
```

> Dev and prod share the `football_mariadb-data` volume (same compose project name), so DB content persists across swaps. The `db-init` scripts only run on a **fresh** volume — if you change `00-create-user.sql` or `01-schema.sql`, you must `podman compose down -v` (destroys data) for them to re-run.

Persistence
-----------

Two named volumes (project name pinned to `football` so the names don't depend on this folder's name):

- `football_mariadb-data` — MariaDB data files. Survives `down`, wiped by `down -v`.
- `football_gradle-cache` — Gradle distribution and resolved dependencies.

The frontend's `node_modules` lives in the bind-mounted source tree, not a volume.

Notes
-----

- All three services run with `network_mode: host` to work around rootless podman not having `pasta`/`slirp4netns` access to `/dev/net/tun` on this machine. Side effect: only one stack can run at a time, since they share the host's port namespace.
- The backend connects to MariaDB at hardcoded `localhost:3306` (see `../TableSoccerREST/src/main/groovy/DbUtil.java`). The frontend calls hardcoded `http://localhost:5050` from the browser. Host networking is what makes both work without code changes.
- The MariaDB image only auto-creates `MARIADB_USER` when a password is also set, so `../TableSoccerREST/db-init/00-create-user.sql` creates the user with empty password before the schema loads. Init scripts only run on a fresh data volume.
- `../TableSoccerREST/Dockerfile` builds the backend as a standalone image (`podman build -t backend ../TableSoccerREST/`). It assumes a MariaDB is reachable at `localhost:3306` — compose handles that, but if running the image on its own you need to provide one.

Local development (without Docker)
----------------------------------

If you'd rather run Vite directly against a backend that's already up:

```
npm install
npm run dev               # Vite dev server on http://localhost:4200
```

Useful scripts:

| Script                 | What it does                                                                |
|------------------------|-----------------------------------------------------------------------------|
| `npm run dev`          | Vite dev server with HMR                                                    |
| `npm run build`        | `tsc -b` then `vite build` → `dist/`                                        |
| `npm run preview`      | Serve the built `dist/` locally for a smoke test                            |
| `npm run lint`         | ESLint over `src/`                                                          |
| `npm run test`         | Vitest in watch mode                                                        |
| `npm run test:run`     | Vitest single-pass (TZ pinned to UTC for deterministic snapshots)           |
| `npm run test:contract`| Run contract tests against a live backend (set `VITE_BACKEND_URL` first)    |
| `npm run format`       | Prettier write                                                              |

`npm run dev` reads `VITE_BACKEND_URL` from `.env` (default `http://localhost:5050`); the production build bakes it in.

Stack
-----

- React 19 + TypeScript (strict)
- Vite 7 build / dev server
- TanStack Router (file-based) + TanStack Query
- React Hook Form + Zod for forms and schema-at-the-edge runtime parsing
- Recharts for the rankings chart
- Vitest + Testing Library + MSW for unit, integration, snapshot, and contract tests
- ESLint + Prettier
- GitHub Actions CI runs type-check / lint / test / build on every push (see `.github/workflows/ci.yml`)
