-- Up Migration

CREATE TYPE agency_status AS ENUM ('UP', 'DEGRADED', 'DOWN');

CREATE TABLE agencies (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  ip    INET NOT NULL UNIQUE
);

-- Current state only: one row per branch, updated in place by the worker.
CREATE TABLE agency_state (
  agency_id              TEXT PRIMARY KEY REFERENCES agencies (id),
  status                 agency_status NOT NULL DEFAULT 'UP',
  consecutive_failures   INT NOT NULL DEFAULT 0,
  consecutive_successes  INT NOT NULL DEFAULT 0,
  last_measured_at       TIMESTAMPTZ,
  last_rtt_ms            NUMERIC(8, 2)
);

CREATE TABLE incidents (
  id         BIGSERIAL PRIMARY KEY,
  ref        TEXT GENERATED ALWAYS AS ('INC-' || lpad(id::text, 4, '0')) STORED,
  agency_id  TEXT NOT NULL REFERENCES agencies (id),
  opened_at  TIMESTAMPTZ NOT NULL,
  closed_at  TIMESTAMPTZ,
  CHECK (closed_at IS NULL OR closed_at >= opened_at)
);

-- At most one open incident per branch, enforced by the database, not only by code.
CREATE UNIQUE INDEX one_open_incident_per_agency ON incidents (agency_id) WHERE closed_at IS NULL;
CREATE INDEX incidents_opened_at ON incidents (opened_at DESC);

INSERT INTO agencies (id, name, ip) VALUES
  ('saint-denis',  'Agence Saint-Denis',  '10.20.0.11'),
  ('saint-paul',   'Agence Saint-Paul',   '10.20.0.12'),
  ('saint-pierre', 'Agence Saint-Pierre', '10.20.0.13');

INSERT INTO agency_state (agency_id) SELECT id FROM agencies;

-- Down Migration

DROP TABLE incidents;
DROP TABLE agency_state;
DROP TABLE agencies;
DROP TYPE agency_status;
