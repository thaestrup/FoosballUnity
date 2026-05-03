FoosballUnity
=============

Frontend (Angular 5 / CLI 1.5) for the foosball / table soccer tournament organizer. This repo also hosts the `docker-compose.yml` that orchestrates the full stack (frontend + backend + database).

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

| Service   | Image                       | Port | Notes                                              |
|-----------|-----------------------------|------|----------------------------------------------------|
| mariadb   | `mariadb:10.11`             | 3306 | DB `nykreditfoosballunity`, user `football` (no pw)|
| backend   | `eclipse-temurin:11-jdk`    | 5050 | Runs `./gradlew run` against bind-mounted source   |
| frontend  | `node:10`                   | 4200 | `ng serve` against bind-mounted source             |

Open <http://localhost:4200> once everything is up.

Quick start
-----------

```
podman compose up -d            # or: docker compose up -d
```

First boot pulls images and downloads Gradle + npm deps; expect a couple of minutes. Subsequent starts are seconds because the gradle cache and `node_modules` are persisted.

Common commands
---------------

```
podman compose up -d                    # start everything
podman compose down                     # stop, keep data
podman compose down -v                  # stop and wipe DB + gradle cache
podman compose logs -f backend          # tail one service
podman compose restart backend          # restart one service
```

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

---

Below: original Angular CLI 1.0 boilerplate from when the project was scaffolded.

## Development server
Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive/pipe/service/class`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `-prod` flag for a production build.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via [Protractor](http://www.protractortest.org/).
Before running the tests make sure you are serving the app via `ng serve`.

## Further help

To get more help on the `angular-cli` use `ng --help` or go check out the [Angular-CLI README](https://github.com/angular/angular-cli/blob/master/README.md).
