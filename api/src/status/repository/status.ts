import type { Pool } from "@bnm/shared";

export interface AgencyStatusRow {
  id: string;
  name: string;
  status: "UP" | "DEGRADED" | "DOWN";
  last_rtt_ms: string | null;
  last_measured_at: Date | null;
  incident_ref: string | null;
  incident_opened_at: Date | null;
}

export interface StatusRepository {
  find(agencyId?: string): Promise<AgencyStatusRow[]>;
}

export function createStatusRepository(pool: Pool): StatusRepository {
  return {
    async find(agencyId) {
      const { rows } = await pool.query<AgencyStatusRow>(
        `SELECT a.id, a.name, s.status, s.last_rtt_ms, s.last_measured_at,
                i.ref AS incident_ref, i.opened_at AS incident_opened_at
           FROM agencies a
           JOIN agency_state s ON s.agency_id = a.id
           LEFT JOIN incidents i ON i.agency_id = a.id AND i.closed_at IS NULL
          WHERE $1::text IS NULL OR a.id = $1
          ORDER BY a.id`,
        [agencyId ?? null],
      );
      return rows;
    },
  };
}
