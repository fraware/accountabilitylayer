# Developer guide: Accountability Layer

Setup, day-to-day development, testing, and deployment for the backend, frontend, and bench workspace.

## Table of contents

- [Project overview](#project-overview)
- [Prerequisites](#prerequisites)
- [Monorepo install](#monorepo-install)
- [Backend](#backend)
- [Frontend](#frontend)
- [Bench and load testing](#bench-and-load-testing)
- [Linting and formatting](#linting-and-formatting)
- [Testing](#testing)
- [OpenAPI](#openapi)
- [Docker Compose](#docker-compose)
- [Deployment notes](#deployment-notes)
- [Environment and secrets](#environment-and-secrets)
- [Contributing](#contributing)

## Project overview

The Accountability Layer helps teams log and audit AI agent decisions. It includes:

- Step-level logging, search, and review workflows
- Anomaly detection and notifications
- REST API and a real-time dashboard
- JWT authentication and role-based access

Stack summary:

- **Backend:** Node 22, Express, TypeScript compiled to `dist/`, Mongoose 8, NATS, optional Redis, OpenTelemetry, pino, Prometheus metrics on `/metrics`
- **Frontend:** Vite 6, React 19, TypeScript, React Router 7, MUI 6, TanStack Query 5, Vitest, Cypress
- **Bench:** `bench/` workspace (autocannon); k6 scripts at repo root for CI

## Prerequisites

- **Node.js 22+** (root `package.json` `engines`)
- **MongoDB** (local or via Docker Compose)
- Optional for full stack: **NATS**, **Redis** (see `docker-compose.yml`)
- **k6** only if you run `bench/load-test-k6.js` locally (see [bench/README.md](../bench/README.md))

## Monorepo install

Workspaces: `backend`, `frontend`, `bench`.

```bash
git clone <repo-url>
cd accountabilitylayer
npm ci
```

Use **`npm ci`** in CI and when you want a clean install from the lockfile. Use **`npm install`** when you add or upgrade dependencies and need to refresh `package-lock.json`.

All `npm run … -w <workspace>` commands below assume your current directory is the **repository root**.

## Backend

1. **Environment:** create `backend/.env`. Common variables:

   ```ini
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/accountability
   JWT_SECRET=your_secret_key
   JWT_EXPIRES_IN=1h
   NATS_URL=nats://127.0.0.1:4222
   REDIS_URL=redis://127.0.0.1:6379
   LOG_LEVEL=info
   ```

   See [README.md](../README.md#configuration) for the full list (OpenTelemetry, rate limits, `SERVE_OPENAPI`, and so on).

2. **Develop** (TypeScript, watch):

   ```bash
   npm run dev -w accountability-backend
   ```

3. **Production build and start:**

   ```bash
   npm run build -w accountability-backend
   npm start -w accountability-backend
   ```

   Entry after build: `dist/app.js`.

4. **OpenAPI:** specification at `docs/api-spec.yaml`. With `SERVE_OPENAPI=true`, Swagger UI is available at `http://localhost:<PORT>/api-docs` (port from `PORT`).

## Frontend

Vite + React 19 + TypeScript + MUI 6 + TanStack Query + React Router.

1. **Environment:** copy `frontend/.env.example` to `frontend/.env`. Only variables prefixed with `VITE_` are exposed to the client.

2. **Develop:**

   ```bash
   npm run dev -w accountability-frontend
   ```

   Default dev server: `http://localhost:3000` (see `frontend/package.json` `dev` script). Unauthenticated users are redirected to `/login`; the dashboard lives at `/`.

3. **Production build:**

   ```bash
   npm run build -w accountability-frontend
   ```

   Output: `frontend/dist/`. The frontend Docker image serves this with nginx.

4. **Typecheck and API types:**

   ```bash
   npm run typecheck -w accountability-frontend
   npm run codegen:api -w accountability-frontend
   ```

   Regenerate `frontend/src/types/api.d.ts` from `docs/api-spec.yaml` whenever the API contract changes.

5. **Preview production build locally:**

   ```bash
   npm run preview -w accountability-frontend
   ```

## Bench and load testing

- **Backend / frontend npm scripts:** see [README.md](../README.md#running-benchmarks) and [bench/README.md](../bench/README.md).
- **`bench/` workspace:** autocannon-based helpers; k6 file `bench/load-test-k6.js` is run by k6 directly.

Examples:

```bash
npm run bench -w accountability-backend
TARGET_URL=http://127.0.0.1:5000 node bench/quick-health-bench.js
k6 run bench/load-test-k6.js
```

## Linting and formatting

From the repository root:

```bash
npm run format:check
npm run format
npm run lint --workspaces --if-present
```

Prettier is configured at the root; individual packages may also define `format` / `format:check` for narrower file globs.

## Testing

### Backend

```bash
npm test -w accountability-backend
```

Tests use **Mocha** with `import=tsx` (see `backend/.mocharc.cjs`) so `require()` can load TypeScript under `src/`. Ensure MongoDB is running and `MONGODB_URI` is set if persistence paths run (for example `mongodb://127.0.0.1:27017/accountability-test`).

### Frontend (Vitest)

```bash
npm run test -w accountability-frontend
npm run test:watch -w accountability-frontend
```

### End-to-end (Cypress)

Start the API and UI (or full Compose stack), then run Cypress. Specs open `/login` to sign in (the app redirects unauthenticated users away from `/`).

```bash
npm run cypress:open -w accountability-frontend
npm run cypress:run -w accountability-frontend
```

## OpenAPI

Validate the spec locally (matches CI):

```bash
npx --yes @redocly/cli@1 lint docs/api-spec.yaml
```

## Docker Compose

```bash
docker compose up --build
```

The **log-worker** service has **no HTTP port**; its healthcheck is disabled in Compose because liveness is process-based. MongoDB initialization uses `scripts/init-mongo.js`. Frontend is exposed on host port **3000** (maps to nginx **80** in the container).

## Deployment notes

- Use the Dockerfiles under `backend/` and `frontend/` (Node 22 build stages; frontend serves static files with a pinned nginx image).
- Inject secrets via your platform (do not bake `.env` into images).
- Align `JWT_SECRET`, `MONGODB_URI`, `NATS_URL`, and frontend `VITE_*` build args with your environment.

## Environment and secrets

- **Local:** `.env` files per app; never commit secrets.
- **Production:** use a secrets manager and inject environment variables at runtime.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the root [README.md](../README.md).
