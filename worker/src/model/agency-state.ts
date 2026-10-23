export type AgencyStatus = "UP" | "DEGRADED" | "DOWN";

export interface AgencyState {
  status: AgencyStatus;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastMeasuredAt: Date | null;
  lastRttMs: number | null;
}

// A measurement as the state machine sees it: already parsed, dates as Date.
export interface Probe {
  measuredAt: Date;
  success: boolean;
  rttMs: number | null;
}
