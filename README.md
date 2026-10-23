# multisite-network-monitor

A small multi-site network monitor. A Python probe pings each branch office, a TypeScript
worker turns the raw results into incidents, and a TypeScript API tells support staff which
branch is down and since when.

An insurer runs its business software at headquarters; every branch reaches it over a leased
line. When a line drops, the branch is paralysed, and without monitoring IT only finds out when
someone calls. This project detects the outage first, opens an incident on its own, and closes
it with a recorded duration once the line is back.

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Liveness probe |
| `POST /v1/measurements` | Ingest a batch of probe results (collector only) |
| `GET /v1/agencies` | Current status of every branch |
| `GET /v1/agencies/:id/status` | Status, last latency and open incident of one branch |
| `GET /v1/incidents` | Incident history with start, end and duration |

Stack:
- **API and worker**: [Node.js](https://nodejs.org) 22 · TypeScript (strict) ·
  [Fastify](https://fastify.dev) · [zod](https://zod.dev) · [Vitest](https://vitest.dev) · npm workspaces
- **Collector**: [Python](https://www.python.org) 3.12 · [icmplib](https://github.com/ValentinBELYN/icmplib) ·
  [httpx](https://www.python-httpx.org) · [pydantic](https://docs.pydantic.dev) · [pytest](https://pytest.org)
- **Storage**: [PostgreSQL](https://www.postgresql.org) 16 · [Redis](https://redis.io) 7 Streams
- **Runtime**: Docker Compose

![System design](docs/system-design.png)

▶ [Outage scenario animation](docs/outage.mp4): a link drops, the branch goes degraded, then
down, an incident opens, support queries it, the link comes back and the incident closes.

---

## Table of contents

- [Quick start](#quick-start)
- [Outage demo](#outage-demo)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Detection rules](#detection-rules)
- [Architecture](#architecture)
- [Project layout](#project-layout)
- [Database](#database)
- [Tests and CI](#tests-and-ci)
- [Out of scope](#out-of-scope)

---

## Quick start

> Requires Docker with the Compose plugin. Running the tests locally also needs Node.js 22+
> and [uv](https://docs.astral.sh/uv/) for Python.

```bash
# 1. Clone
git clone https://github.com/Mimi-a24/multisite-network-monitor.git
cd multisite-network-monitor

# 2. Create your environment file (it already holds working values for local development)
cp .env.example .env

# 3. Start everything: API, worker, collector, PostgreSQL, Redis and the 3 simulated branches
make up

# 4. Smoke test (replace 3000 with your API_PORT)
curl -s http://127.0.0.1:3000/health
./scripts/status.sh
```

`make up` builds the images, runs the migrations once (the `migrate` service), then starts the
API and the worker. Use `127.0.0.1` rather than `localhost` if another local app already
listens on `::1:3000`. `scripts/status.sh` needs `curl` and `jq`.
Stop the stack with `make down` (add `-v` to `docker compose down` to also delete the volumes).

---

## Outage demo

The branches are not part of the code. In production each one is a router on a remote site;
nothing is installed there, the collector only pings it. The lab stands in for them with
3 Alpine containers on a dedicated Docker network (`wan`, `10.20.0.0/24`) that answer ICMP like
a router would. Cutting one from the network is, from the collector's point of view, the same
as a dead leased line.

```bash
make outage AGENCY=saint-pierre    # docker network disconnect
./scripts/status.sh                # watch it go DEGRADED, then DOWN
make restore AGENCY=saint-pierre   # docker network connect
./scripts/status.sh                # back to UP, incident closed
make logs                          # api + worker + collector
```

With the default 10 s probe interval, the incident opens about 30 s after the cut and closes
about 20 s after the restore. Measured on the lab: `DEGRADED` after 6 s, `DOWN` with
`INC-0001` after 25 s, back to `UP` 14 s after the restore.

| Time | Event |
| --- | --- |
| t+10 s | 1st failure: `saint-pierre` is `DEGRADED`, no incident |
| t+30 s | 3rd consecutive failure: `DOWN`, incident `INC-0001` opened |
| restore +10 s | 1st success: still `DOWN` |
| restore +20 s | 2nd consecutive success: `UP`, incident closed, duration recorded |

---

## Configuration

All configuration comes from environment variables, validated at startup by
`api/src/config/` and `worker/src/config/` (zod, through `shared/src/config/env.ts`) and
`collector/src/collector/config.py` (pydantic).
Docker Compose reads them from `.env`.

```ini
API_PORT=3000
COLLECTOR_API_KEY=local-dev-key-change-me

POSTGRES_DB=monitor
POSTGRES_USER=monitor
POSTGRES_PASSWORD=monitor
DATABASE_URL=postgres://monitor:monitor@postgres:5432/monitor
REDIS_URL=redis://redis:6379
FAILURES_TO_OPEN=3
SUCCESSES_TO_CLOSE=2

API_URL=http://api:3000
AGENCIES=saint-denis=10.20.0.11,saint-paul=10.20.0.12,saint-pierre=10.20.0.13
PROBE_INTERVAL_SECONDS=10
```

| Variable | Required | Default | Read by | Purpose |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | yes | — | api, worker | PostgreSQL connection string |
| `REDIS_URL` | yes | — | api, worker | Redis connection string |
| `COLLECTOR_API_KEY` | yes | — | api, collector | Shared secret sent in `X-Api-Key` |
| `API_URL` | yes | — | collector | Where the collector posts measurements |
| `AGENCIES` | yes | — | collector | Branches to ping, as `id=ip` pairs |
| `API_PORT` | no | `3000` | api, Compose | HTTP port |
| `PROBE_INTERVAL_SECONDS` | no | `10` | collector | Time between two probe cycles |
| `FAILURES_TO_OPEN` | no | `3` | worker | Consecutive failures before an incident opens |
| `SUCCESSES_TO_CLOSE` | no | `2` | worker | Consecutive successes before it closes |
| `WORKER_NAME` | no | `worker-1` | worker | Consumer name in the Redis group; a restarted worker with the same name replays its unacknowledged messages |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | no | `monitor` | Compose | Credentials of the PostgreSQL container; keep them in sync with `DATABASE_URL` |

A missing required value is an error, not a silent fallback: the process exits at startup and
logs every problem at once.

---

## API reference

### `GET /health`

Returns `200 OK` once the process is up.

### `POST /v1/measurements`

Called by the collector only. Requires the `X-Api-Key` header.

```json
{
  "measurements": [
    {
      "id": "0b8f8a52-4a8e-4c0e-9d5e-2f3f1c6b9a10",
      "agency_id": "saint-pierre",
      "measured_at": "2026-10-20T09:41:00Z",
      "success": false,
      "rtt_ms": null
    }
  ]
}
```

| Status | When |
| --- | --- |
| `202 Accepted` | Body is valid; every measurement was appended to the `measurements` stream. Body: `{ "accepted": 1 }` |
| `400 Bad Request` | Body fails zod validation (1 to 1000 measurements, UUID `id`, ISO 8601 `measured_at`, `rtt_ms` null on a failure). Body: `{ "error": "invalid body", "details": … }` |
| `401 Unauthorized` | Missing or wrong `X-Api-Key` (compared in constant time) |

The collector sends **raw** results. Deciding whether a branch is down is the worker's job.
The format is defined twice, in zod (`shared/src/contracts/measurement.ts`) and in pydantic
(`collector/src/collector/models.py`); the API validates every request, so a drift between
the two shows up as a `400`, not as bad data.

### `GET /v1/agencies/:id/status`

```bash
curl -s http://127.0.0.1:3000/v1/agencies/saint-pierre/status
```

```json
{
  "id": "saint-pierre",
  "name": "Agence Saint-Pierre",
  "status": "DOWN",
  "last_rtt_ms": null,
  "last_measured_at": "2026-10-20T09:43:00Z",
  "open_incident": { "ref": "INC-0001", "opened_at": "2026-10-20T09:43:00Z" }
}
```

`404 Not Found` for an unknown branch. `GET /v1/agencies` returns the same object for every
branch.

### `GET /v1/incidents`

The 100 most recent, newest first. `closed_at` and `duration_seconds` are `null` while the
incident is open.

```json
[
  {
    "ref": "INC-0001",
    "agency_id": "saint-pierre",
    "opened_at": "2026-10-20T09:43:00Z",
    "closed_at": "2026-10-20T09:57:00Z",
    "duration_seconds": 840
  }
]
```

---

## Detection rules

The state machine is a pure function, `next(state, measurement) → { state, event }`, with no
database or Redis dependency, so it is tested in isolation.

| Status | Entered when | Event |
| --- | --- | --- |
| `UP` | Measurement OK, or 2 consecutive successes after an outage | `INCIDENT_CLOSED` if one was open |
| `DEGRADED` | 1 or 2 consecutive failures | none |
| `DOWN` | 3 consecutive failures | `INCIDENT_OPENED` |

- **Why 3 failures?** One lost packet is not an outage. The price is a detection delay of
  3 probe intervals.
- **Why 3 to open but 2 to close?** Hysteresis: it stops a flaky line from flapping between
  `UP` and `DOWN` on every cycle.
- **Duplicates and out-of-order delivery**: a measurement whose `measured_at` is not newer
  than the branch's `last_measured_at` is ignored.
- **One open incident per branch**, enforced by a partial unique index, not only by code.

---

## Architecture

```
saint-denis  ┐
saint-paul   ├─ ICMP ─ collector ── POST /v1/measurements ──► api ── XADD ──► redis stream
saint-pierre ┘          (Python)                              │                    │ XREADGROUP
                                                              │ SELECT             ▼
curl ── GET /v1/agencies/:id/status ──────────────────────► api ◄── postgres ◄── worker
```

- **The collector sits at headquarters**, the only place that can reach branch routers. Nothing
  is installed in the branches; a ping tests the whole round trip.
- **Two languages, one boundary.** The collector is a Python script, the usual tool for network
  automation. API and worker are a TypeScript service. They only talk over HTTP.
- **The API only validates and enqueues**, then answers `202`. It never runs detection logic.
- **One Redis stream, one consumer group.** If the worker stops, measurements wait in the
  stream; on restart it first replays what it had received but not acknowledged, then reads
  the rest. A malformed message is logged and acknowledged so it cannot block the stream. The worker updates state and opens or closes the
  incident in **one transaction**, and only then sends `XACK`.
- **Only state changes are written**, not every ping: `agency_state` holds the current status,
  `incidents` holds the history.
- **Why not one queue per branch?** With a single worker, one stream already preserves arrival
  order. Per-branch partitions only pay off with several workers, which is the answer to
  "what about 300 branches?".
- **API and worker are two separate services**, each with its own folder, image and container.
  What they both need (config parsing, the measurement contract, PostgreSQL and Redis clients)
  lives in `shared/`, an npm workspace they both depend on.

Inside the API, requests flow in one direction only, from transport down to storage:

```
HTTP request
   │
   ▼
router  (api/src/router)                Fastify, API key hook, route table
   │
   ▼
handler (api/src/*/handler)             parse input with zod, map DTO ⇄ model
   │
   ▼
service (api/src/*/service)             use cases (enqueue, list, detail)
   │
   ▼
repository (api/src/*/repository)       SQL reads against PostgreSQL
   │
   ▼
infrastructure (shared)                 PostgreSQL and Redis clients
```

- Layers depend **downward only**; no layer imports one above it.
- Each feature keeps its own `dto` (wire format) types.
- All wiring lives in `api/src/server/server.ts`. Add an endpoint by adding a handler and a
  route, not by editing the entrypoint.

The worker follows the same direction, with the stream instead of HTTP at the top:

```
stream message
   │
   ▼
consumer (worker/src/consumer)          XREADGROUP loop
   │
   ▼
service (worker/src/service)            state machine + processor (transaction, then XACK)
   │
   ▼
repository (worker/src/repository)      agency_state and incidents writes
   │
   ▼
infrastructure (shared)                 PostgreSQL and Redis clients
```

---

## Project layout

```
multisite-network-monitor/
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── api/
│   ├── src/
│   │   ├── main.ts
│   │   │
│   │   ├── config/
│   │   │   ├── config.ts
│   │   │   └── config.test.ts
│   │   │
│   │   ├── server/
│   │   │   └── server.ts
│   │   │
│   │   ├── router/
│   │   │   ├── router.ts
│   │   │   ├── api-key.ts
│   │   │   ├── health.ts
│   │   │   ├── measurements.ts
│   │   │   ├── status.ts
│   │   │   └── incidents.ts
│   │   │
│   │   ├── measurements/
│   │   │   ├── handler/
│   │   │   │   ├── measurements.ts
│   │   │   │   └── measurements.test.ts
│   │   │   └── service/
│   │   │       └── measurements.ts
│   │   │
│   │   ├── status/
│   │   │   ├── dto/
│   │   │   │   └── agency-status.ts
│   │   │   ├── handler/
│   │   │   │   ├── status.ts
│   │   │   │   └── status.test.ts
│   │   │   ├── service/
│   │   │   │   └── status.ts
│   │   │   └── repository/
│   │   │       └── status.ts
│   │   │
│   │   └── incidents/
│   │       ├── dto/
│   │       │   └── incident.ts
│   │       ├── handler/
│   │       │   └── incidents.ts
│   │       ├── service/
│   │       │   └── incidents.ts
│   │       └── repository/
│   │           └── incidents.ts
│   │
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── worker/
│   ├── src/
│   │   ├── main.ts
│   │   │
│   │   ├── config/
│   │   │   ├── config.ts
│   │   │   └── config.test.ts
│   │   │
│   │   ├── consumer/
│   │   │   └── consumer.ts
│   │   │
│   │   ├── model/
│   │   │   ├── agency-state.ts
│   │   │   └── state-event.ts
│   │   │
│   │   ├── service/
│   │   │   ├── state-machine.ts
│   │   │   ├── state-machine.test.ts
│   │   │   └── processor.ts
│   │   │
│   │   └── repository/
│   │       └── monitoring.ts
│   │
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── shared/
│   ├── src/
│   │   ├── index.ts
│   │   ├── config/
│   │   │   └── env.ts
│   │   ├── contracts/
│   │   │   └── measurement.ts
│   │   └── infrastructure/
│   │       ├── postgres/
│   │       │   └── client.ts
│   │       └── redis/
│   │           ├── client.ts
│   │           └── stream.ts
│   ├── package.json
│   └── tsconfig.json
│
├── collector/
│   ├── src/
│   │   └── collector/
│   │       ├── __init__.py
│   │       ├── __main__.py
│   │       ├── config.py
│   │       ├── models.py
│   │       ├── pinger.py
│   │       └── client.py
│   ├── tests/
│   │   ├── test_pinger.py
│   │   └── test_config.py
│   ├── .dockerignore
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── uv.lock
│
├── migrations/
│   └── 001_init.sql
│
├── lab/
│   └── agency/
│       └── Dockerfile
│
├── scripts/
│   └── status.sh
│
├── docs/
│   ├── system-design.png
│   └── outage.mp4
│
├── .dockerignore
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── tsconfig.base.json
├── eslint.config.js
├── vitest.config.ts
├── docker-compose.yml
├── Makefile
└── README.md
```

`api/src/status/` serves the status **of** the branches; the branches themselves live in `lab/`.
`shared/` holds only what both services need: config parsing, the measurement contract and the
PostgreSQL/Redis clients. Repositories stay in the service that owns the query.

---

## Database

Migrations live in `migrations/` as numbered SQL files (`001_init.sql`), each with an
`-- Up Migration` and a `-- Down Migration` section, applied with
[node-pg-migrate](https://github.com/salsita/node-pg-migrate).

```bash
make migrate-up     # apply all pending migrations
make migrate-down   # roll back the last migration
```

| Table | Holds |
| --- | --- |
| `agencies` | `id`, `name`, `ip` of each branch router |
| `agency_state` | Current `status`, consecutive failure and success counters, last measurement time and RTT |
| `incidents` | `agency_id`, `opened_at`, `closed_at`; unique index on `agency_id` where `closed_at IS NULL` |

---

## Tests and CI

```bash
npm ci && (cd collector && uv sync)   # once
make typecheck
make lint
make test                             # Vitest + pytest
```

| Level | Tool | Covers |
| --- | --- | --- |
| Unit | Vitest | State machine: 1 failure, 3 failures, 2 successes, flapping, stale measurement |
| Unit | Vitest | Config: missing value → error, defaults |
| Route | Vitest + `fastify.inject` | `202` valid batch, `400` invalid body, `401` wrong key, `404` unknown branch |
| Unit | pytest | Collector: median RTT, success/failure, `AGENCIES` parsing |

GitHub Actions runs three jobs on every push and pull request: `typescript` (`tsc`, ESLint and
Vitest across `api`, `worker` and `shared`), `collector` (Ruff, pytest) and `docker`
(`docker compose build`).

---

## Out of scope

Deliberately left out to keep the project small. Each is a known next step:

- **Real branch routers**: the lab containers answer ping only. In production the collector
  would target each branch router's LAN IP; nothing else changes.
- **Web dashboard and user auth**: `curl` and `scripts/status.sh` cover the demo.
- **SNMP**: ping tells whether a line answers and how fast; SNMP would read interface state and
  error counters.
- **WAN latency simulation**: `tc netem` on a lab container would add delay and packet loss.
- **Application-level checks**: ping tests layer 3; an HTTP check on business apps would test
  layer 7.
- **`UNKNOWN` status**: flagging branches with no measurement for a while, to detect a dead
  collector.
- **Headquarters outage**: if every branch fails in the same cycle, the problem is probably the
  probe or HQ, and a single incident should be raised instead of three.
- **Deployment**: the stack runs on any Linux host with Docker Compose; the same infrastructure
  could be described in Terraform for Azure.
