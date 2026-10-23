import type { AgencyState, Probe } from "../model/agency-state.js";
import type { StateEvent } from "../model/state-event.js";

export interface Thresholds {
  failuresToOpen: number;
  successesToClose: number;
}

export type Transition =
  | { stale: true }
  | { stale: false; state: AgencyState; event: StateEvent | null };

// Pure: no database, no Redis, no clock. Everything it needs is in its arguments.
export function next(state: AgencyState, probe: Probe, thresholds: Thresholds): Transition {
  // Duplicates and late arrivals must not rewind the state.
  if (state.lastMeasuredAt && probe.measuredAt <= state.lastMeasuredAt) return { stale: true };

  const measured = { lastMeasuredAt: probe.measuredAt, lastRttMs: probe.success ? probe.rttMs : null };

  if (probe.success) {
    const successes = state.consecutiveSuccesses + 1;
    const counters = { ...measured, consecutiveFailures: 0, consecutiveSuccesses: successes };
    if (state.status !== "DOWN") return transition({ ...counters, status: "UP" }, null);
    // Hysteresis: one good ping is not enough to call a broken line repaired.
    if (successes < thresholds.successesToClose) return transition({ ...counters, status: "DOWN" }, null);
    return transition({ ...counters, status: "UP" }, "INCIDENT_CLOSED");
  }

  const failures = state.consecutiveFailures + 1;
  const counters = { ...measured, consecutiveFailures: failures, consecutiveSuccesses: 0 };
  if (state.status === "DOWN") return transition({ ...counters, status: "DOWN" }, null);
  if (failures < thresholds.failuresToOpen) return transition({ ...counters, status: "DEGRADED" }, null);
  return transition({ ...counters, status: "DOWN" }, "INCIDENT_OPENED");
}

function transition(state: AgencyState, event: StateEvent | null): Transition {
  return { stale: false, state, event };
}
