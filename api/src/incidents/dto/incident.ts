import type { IncidentRow } from "../repository/incidents.js";

export interface IncidentDto {
  ref: string;
  agency_id: string;
  opened_at: string;
  closed_at: string | null;
  duration_seconds: number | null;
}

export function toIncidentDto(row: IncidentRow): IncidentDto {
  return {
    ref: row.ref,
    agency_id: row.agency_id,
    opened_at: row.opened_at.toISOString(),
    closed_at: row.closed_at?.toISOString() ?? null,
    duration_seconds: row.duration_seconds,
  };
}
