import type { AgencyStatusRow } from "../repository/status.js";

export interface AgencyStatusDto {
  id: string;
  name: string;
  status: "UP" | "DEGRADED" | "DOWN";
  last_rtt_ms: number | null;
  last_measured_at: string | null;
  open_incident: { ref: string; opened_at: string } | null;
}

export function toAgencyStatusDto(row: AgencyStatusRow): AgencyStatusDto {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    last_rtt_ms: row.last_rtt_ms === null ? null : Number(row.last_rtt_ms),
    last_measured_at: row.last_measured_at?.toISOString() ?? null,
    open_incident:
      row.incident_ref && row.incident_opened_at
        ? { ref: row.incident_ref, opened_at: row.incident_opened_at.toISOString() }
        : null,
  };
}
