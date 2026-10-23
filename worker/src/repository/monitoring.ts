import type { PoolClient } from "@bnm/shared";
import type { AgencyState, AgencyStatus } from "../model/agency-state.js";

interface StateRow {
  status: AgencyStatus;
  consecutive_failures: number;
  consecutive_successes: number;
  last_measured_at: Date | null;
  last_rtt_ms: string | null;
}

// FOR UPDATE: two messages for the same branch can't interleave their read-modify-write.
// Returns null for a branch that doesn't exist.
export async function lockState(client: PoolClient, agencyId: string): Promise<AgencyState | null> {
  const { rows } = await client.query<StateRow>(
    `SELECT status, consecutive_failures, consecutive_successes, last_measured_at, last_rtt_ms
       FROM agency_state WHERE agency_id = $1 FOR UPDATE`,
    [agencyId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    status: row.status,
    consecutiveFailures: row.consecutive_failures,
    consecutiveSuccesses: row.consecutive_successes,
    lastMeasuredAt: row.last_measured_at,
    lastRttMs: row.last_rtt_ms === null ? null : Number(row.last_rtt_ms),
  };
}

export async function saveState(client: PoolClient, agencyId: string, state: AgencyState): Promise<void> {
  await client.query(
    `UPDATE agency_state
        SET status = $2, consecutive_failures = $3, consecutive_successes = $4,
            last_measured_at = $5, last_rtt_ms = $6
      WHERE agency_id = $1`,
    [agencyId, state.status, state.consecutiveFailures, state.consecutiveSuccesses, state.lastMeasuredAt, state.lastRttMs],
  );
}

export async function openIncident(client: PoolClient, agencyId: string, openedAt: Date): Promise<string | null> {
  const { rows } = await client.query<{ ref: string }>(
    `INSERT INTO incidents (agency_id, opened_at) VALUES ($1, $2)
     ON CONFLICT (agency_id) WHERE closed_at IS NULL DO NOTHING
     RETURNING ref`,
    [agencyId, openedAt],
  );
  return rows[0]?.ref ?? null;
}

export async function closeIncident(client: PoolClient, agencyId: string, closedAt: Date): Promise<string | null> {
  const { rows } = await client.query<{ ref: string }>(
    `UPDATE incidents SET closed_at = $2 WHERE agency_id = $1 AND closed_at IS NULL RETURNING ref`,
    [agencyId, closedAt],
  );
  return rows[0]?.ref ?? null;
}
