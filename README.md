<h1 align="center">Accountability Layer</h1>

<p align="center">
  <strong>Audit and accountability for AI agents</strong><br />
  Capture decision steps, detect anomalies, and give teams a searchable trail with a modern API and dashboard.
</p>

<p align="center">
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node.js-22%2B-417896?logo=node.js&logoColor=white" alt="Node.js 22+" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
</p>

<p align="center">
  <img src="assets/logo.png" width="260" alt="Accountability Layer logo: stylized brain with circuit traces, magnifying glass, and checkmark" />
</p>

---

## Quick start

**Requirements:** [Node.js 22+](https://nodejs.org/) and, for integration tests or full features, MongoDB (and optionally NATS, Redis via Compose).

```bash
git clone <repository-url>
cd accountabilitylayer
npm ci
```

Run the API and UI in two terminals (from the **repository root**):

```bash
npm run dev -w accountability-backend
npm run dev -w accountability-frontend
```

- API default: `http://localhost:5000` (see `PORT` in `backend/.env`)
- UI default: `http://localhost:3000`

**Full stack** (MongoDB, NATS, Redis, backend, notifier, worker, frontend, Prometheus, Grafana):

```bash
docker compose up --build
```

Copy `frontend/.env.example` to `frontend/.env` and create `backend/.env` for local secrets. See [Configuration](#configuration) and [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) for details.

---

## What you get

| Area | Details |
| ---- | ------- |
| **Audit trail** | Structured logs per agent and step, review workflow, search |
| **API** | REST under `/api/v1`, JWT auth, OpenAPI spec in `docs/api-spec.yaml` |
| **Dashboard** | Vite, React 19, MUI 6, TanStack Query, virtualized lists |
| **Pipeline** | NATS JetStream for log events; worker consumes and persists |
| **Real-time** | Notifier with Socket.IO; Redis adapter for horizontal scale |
| **Operations** | Request IDs, structured logs (pino), Prometheus `/metrics`, OpenTelemetry |

---

## Architecture

Services talk over HTTP, NATS, and MongoDB. The diagram below is a high-level map; ports follow your `.env` and Compose file.

```mermaid
flowchart TB
  subgraph edge["Clients"]
    UI["Dashboard<br/>Vite · React 19"]
  end

  subgraph app["Application tier"]
    API["Backend API<br/>Express · TypeScript"]
    NOT["Notifier<br/>Socket.IO"]
    WRK["Log worker<br/>NATS consumer"]
  end

  subgraph data["Data & messaging"]
    MDB[("MongoDB<br/>time-series · TTL")]
    NATS["NATS JetStream"]
    RDS[("Redis<br/>adapter · limits")]
  end

  subgraph obs["Observability"]
    PROM["Prometheus"]
    GRAF["Grafana"]
  end

  UI <-->|REST · JWT| API
  UI <-->|WebSocket| NOT
  API --> NATS
  WRK --> NATS
  WRK --> MDB
  NOT --> RDS
  API --> MDB
  API --> PROM
  PROM --> GRAF
```

---

## Repository layout

Monorepo with **npm workspaces** (always install from the root).

| Workspace | Path | Role |
| --------- | ---- | ---- |
| Root | `.` | Shared scripts, Prettier |
| `accountability-backend` | `backend/` | API, TypeScript → `dist/` |
| `accountability-frontend` | `frontend/` | SPA build |
| `accountability-bench` | `bench/` | Load helpers (autocannon, k6 scripts) |

---

## Data model

MongoDB **time-series** style storage keeps writes and queries efficient for high-volume agent logs.

**Document shape (conceptual):**

```javascript
{
  agent_id: String, // meta (time-series)
  timestamp: Date, // time field
  step_id: Number,
  trace_id: String,
  user_id: String,
  input_data: Mixed,
  output: Mixed,
  reasoning: String,
  status: String, // success | failure | anomaly
  reviewed: Boolean,
  review_comments: String,
  metadata: Mixed,
  version: Number,
  retention_tier: String, // hot | warm | cold
  hash: String,
  createdAt: Date,
  updatedAt: Date,
}
```

**Indexes (typical):** compound `(agent_id, timestamp)`, `(status, timestamp)`; TTL by retention; text on reasoning and comments; covering indexes for hot queries.

---

## Events & real-time

**NATS JetStream (streams):**

| Stream | Role |
| ------ | ---- |
| `LOGS` | Primary log pipeline |
| `LOGS_DLQ` | Failed deliveries |
| `AUDIT` | Audit events |
| `RETRY` | Backoff retries |

**Example subjects / payloads:**

```javascript
// logs.create
{ subject: 'logs.create', data: { /* log */ }, metadata: { userId, ip, userAgent }, idempotencyKey, timestamp }

// logs.update
{ subject: 'logs.update', data: { logId, updates }, metadata: { userId, ip, userAgent }, auditTrail: true }

// logs.bulk
{ subject: 'logs.bulk', data: { logs: [] }, metadata: { userId, ip, userAgent, count }, batchId }
```

**Socket.IO (notifier):** rooms keyed by filters, Redis adapter for multiple notifier instances, rate limits and backpressure for large rooms.

```javascript
socket.emit('join-room', { room: 'agent-logs', filters: { agentId: 'agent-1' }, userId: 'user-123' });
socket.on('log-created', (data) => { /* ... */ });
```

---

## Observability

| Endpoint | Purpose |
| -------- | ------- |
| `GET /healthz` | Liveness |
| `GET /readyz` | Readiness |
| `GET /metrics` | Prometheus scrape |
| `GET /telemetry` | Telemetry status |

OpenTelemetry covers traces and metrics with OTLP export; the stack auto-instruments HTTP, MongoDB, Redis, and NATS where configured.

**Grafana** (Compose): `http://localhost:3002` — default credentials are defined in Compose (`admin` / `admin123` unless you changed them). Dashboards cover services, logs, the event bus, WebSockets, and traces.

---

## API

**Logs**

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/api/v1/logs` | Create one log |
| `POST` | `/api/v1/logs/bulk` | Create many |
| `GET` | `/api/v1/logs/:agent_id` | List by agent |
| `GET` | `/api/v1/logs/:agent_id/:step_id` | Single log |
| `PUT` | `/api/v1/logs/:agent_id/:step_id` | Update review fields |
| `GET` | `/api/v1/logs/search` | Filtered search |
| `GET` | `/api/v1/logs/summary/:agent_id` | Summary |

**Health & ops** (often unauthenticated): `/healthz`, `/readyz`, `/metrics`, `/telemetry`.

**Authentication:** send a JWT on protected routes:

```bash
curl -H "Authorization: Bearer <token>" "http://localhost:5000/api/v1/logs"
```

Interactive docs: set `SERVE_OPENAPI=true` and open `/api-docs` (Swagger from `docs/api-spec.yaml`).

---

## Docker Compose

```bash
docker compose up --build
```

The **log-worker** has no HTTP server; its healthcheck is **disabled** in Compose because liveness is process-based. MongoDB is initialized with [`scripts/init-mongo.js`](scripts/init-mongo.js) on first start. Frontend is published on host port **3000** (nginx inside the container).

---

## Configuration

**Backend (representative variables):**

| Variable | Role |
| -------- | ---- |
| `MONGODB_URI` | Database connection |
| `NATS_URL` | Messaging |
| `REDIS_URL` | Cache / notifier adapter |
| `PORT` | API port |
| `NOTIFIER_PORT` | Notifier |
| `FRONTEND_URL` | CORS / notifier origins |
| `JWT_SECRET` | Token signing |
| `OTLP_ENDPOINT` | Trace/metric export |
| `LOG_LEVEL` | pino level |
| `SERVE_OPENAPI` | `true` to mount Swagger UI |
| `RATE_LIMIT_ENABLED`, `COMPRESSION_ENABLED` | Middleware toggles |

**Example `.env` fragment:**

```bash
MONGODB_URI=mongodb://admin:password@localhost:27017/accountability
NATS_URL=nats://localhost:4222
REDIS_URL=redis://localhost:6379
OTLP_ENDPOINT=http://localhost:4318
PORT=5000
NOTIFIER_PORT=3001
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your-secret-key
LOG_LEVEL=info
SERVE_OPENAPI=true
```

**Frontend (Vite):** only `VITE_*` variables are exposed to the browser. Copy `frontend/.env.example` to `frontend/.env`.

```bash
VITE_API_URL=http://localhost:5000/api/v1
VITE_NOTIFIER_URL=http://localhost:3001
```

---

## Testing & quality

```bash
npm ci
# or: npm install   # when changing dependencies / lockfile
```

| Command | Purpose |
| ------- | ------- |
| `npm test -w accountability-backend` | Mocha + tsx (`.mocharc.cjs`); needs MongoDB when persistence is exercised |
| `npm run test -w accountability-frontend` | Vitest |
| `npm run cypress:run -w accountability-frontend` | E2E (start API + UI first) |
| `npm run lint --workspaces --if-present` | ESLint per package |
| `npm run format:check` | Prettier (root) |
| `npx --yes @redocly/cli@1 lint docs/api-spec.yaml` | OpenAPI (matches CI) |
| `npm audit --audit-level=high` | Dependency audit; CI also audits `backend/` and `frontend/` |

More: [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md), [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

---

## Benchmarks

From the **repository root** (after `npm ci`):

| Target | Command |
| ------ | ------- |
| Backend suites | `npm run bench -w accountability-backend` (and `bench:comprehensive`, `bench:mongo`, `bench:e2e`, `profile`) |
| Frontend | `npm run bench -w accountability-frontend`, `npm run lighthouse -w accountability-frontend` |
| HTTP smoke | `TARGET_URL=http://127.0.0.1:5000 node bench/quick-health-bench.js` |
| k6 (install [k6](https://k6.io/) separately) | `k6 run --summary-export=bench/k6-summary.json bench/load-test-k6.js` |
| Heavy autocannon | `node bench/load-test.js --users 1000 --duration 300` |

Outputs land under `backend/bench/`, `frontend/bench/`, or `bench/` depending on the script. Full notes: [bench/README.md](bench/README.md).

---

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md): branch from the default line, run format/lint/tests for workspaces you touch, and keep docs in sync with behavior.

---

## License

Released under the [MIT License](LICENSE).

---

## Acknowledgments

Built with ideas and software from the MongoDB, NATS, Socket.IO, OpenTelemetry, Prometheus, Grafana, and wider open-source communities.

---

## Support

Open an issue for bugs or design discussion. Use health and metrics endpoints when debugging deployments, and refer to this README and the [developer guide](docs/DEVELOPER_GUIDE.md) for everyday workflows.
