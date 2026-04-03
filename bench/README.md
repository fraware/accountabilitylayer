# Accountability Layer benchmarks and load scripts

This package holds **Node-based** load utilities (`autocannon`) and shared scripts used with **k6** in CI. Backend and frontend also ship their own benchmark npm scripts under `backend/` and `frontend/`.

## Install

Bench dependencies install with the rest of the monorepo from the **repository root**:

```bash
cd /path/to/accountabilitylayer
npm ci
```

CI sometimes uses `npm ci --prefix bench` when only the bench folder is needed; locally, root `npm ci` is enough because `bench` is a workspace.

## Backend (workspace: `accountability-backend`)

Run from the repo root:

```bash
npm run bench -w accountability-backend
npm run bench:comprehensive -w accountability-backend
npm run bench:mongo -w accountability-backend
npm run bench:e2e -w accountability-backend
npm run profile -w accountability-backend
```

Or from `backend/` with `npm run <script>` as usual.

Artifacts (when scripts write them) typically land under `backend/bench/` (for example performance or Mongo reports, depending on the script).

## Frontend (workspace: `accountability-frontend`)

```bash
npm run bench -w accountability-frontend
npm run lighthouse -w accountability-frontend
```

`lighthouse` expects the Vite dev server (or preview) at `http://localhost:3000` unless you change the script in `frontend/package.json`.

Reports often go under `frontend/bench/`.

## This folder (`bench/`): HTTP smoke and k6

### Quick health check (autocannon)

Requires the API listening (default `http://127.0.0.1:5000`):

```bash
node bench/quick-health-bench.js
```

Override the base URL:

```bash
set TARGET_URL=http://localhost:5000
node bench/quick-health-bench.js
```

On Unix:

```bash
TARGET_URL=http://localhost:5000 node bench/quick-health-bench.js
```

### k6 load script

Install [k6](https://k6.io/docs/get-started/installation/) separately. From the repo root:

```bash
k6 run --summary-export=bench/k6-summary.json bench/load-test-k6.js
```

Default target is `http://127.0.0.1:5000`. Override:

```bash
k6 run -e TARGET_URL=http://localhost:5000 bench/load-test-k6.js
```

### Legacy Node load test

```bash
node bench/load-test.js --users 1000 --duration 300
```

(Use `--help` or read the script if flags differ in your checkout.)

### Aggregate report helper

```bash
node bench/generate-performance-report.js
```

Used in CI after other steps produce JSON inputs; see `.github/workflows/ci.yml` for the exact sequence.

## Interpreting results

- Prefer **p95/p99** latency and error rates over averages alone.
- Compare runs on the same hardware and with the same `TARGET_URL` / env.
- Watch memory and CPU when profiling (`npm run profile -w accountability-backend`).

## CI

The workflow runs backend/frontend bench scripts, `quick-health-bench.js`, k6 against `load-test-k6.js`, and report generation where configured. Artifact paths are defined in `.github/workflows/ci.yml`.
