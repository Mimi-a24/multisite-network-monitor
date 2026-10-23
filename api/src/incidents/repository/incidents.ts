import type { Pool } from "@bnm/shared";

export interface IncidentRow {
  ref: string;
  agency_id: string;
  opened_at: Date;
  closed_at: Date | null;
  duration_seconds: number | null;
}

export interface IncidentsRepository {
  list(limit: number): Promise<IncidentRow[]>;
}

export function createIncidentsRepository(pool: Pool): IncidentsRepository {
  return {
    async list(limit) {
      const { rows } = await pool.query<IncidentRow>(
        `SELECT ref, agency_id, opened_at, closed_at,
                EXTRACT(EPOCH FROM closed_at - opened_at)::int AS duration_seconds
           FROM incidents
          ORDER BY opened_at DESC, id DESC
          LIMIT $1`,
        [limit],
      );
      return rows;
    },
  };
}
