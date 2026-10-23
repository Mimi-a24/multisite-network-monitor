import { describe, expect, it } from "vitest";
import type { AgencyState, AgencyStatus } from "../model/agency-state.js";
import type { StateEvent } from "../model/state-event.js";
import { next, type Thresholds } from "./state-machine.js";

const thresholds: Thresholds = { failuresToOpen: 3, successesToClose: 2 };

const initial: AgencyState = {
  status: "UP",
  consecutiveFailures: 0,
  consecutiveSuccesses: 0,
  lastMeasuredAt: null,
  lastRttMs: null,
};

// Feeds a sequence of results (true = ping answered) one minute apart,
// and records the status and event after each one.
function run(results: boolean[], from: AgencyState = initial) {
  let state = from;
  return results.map((success, i) => {
    const t = next(state, { measuredAt: new Date(Date.UTC(2026, 9, 20, 9, i)), success, rttMs: success ? 18 : null }, thresholds);
    if (t.stale) throw new Error("unexpected stale measurement");
    state = t.state;
    return [t.state.status, t.event] as [AgencyStatus, StateEvent | null];
  });
}

describe("state machine", () => {
  it.each<[string, boolean[], [AgencyStatus, StateEvent | null][]]>([
    ["stays UP while pings answer", [true, true], [["UP", null], ["UP", null]]],
    ["1 failure: DEGRADED, no incident", [false], [["DEGRADED", null]]],
    ["2 failures: still DEGRADED", [false, false], [["DEGRADED", null], ["DEGRADED", null]]],
    ["3 failures: DOWN and incident opened", [false, false, false], [["DEGRADED", null], ["DEGRADED", null], ["DOWN", "INCIDENT_OPENED"]]],
    ["4th failure: still DOWN, no second incident", [false, false, false, false], [["DEGRADED", null], ["DEGRADED", null], ["DOWN", "INCIDENT_OPENED"], ["DOWN", null]]],
    ["a success while DEGRADED goes straight back to UP", [false, false, true], [["DEGRADED", null], ["DEGRADED", null], ["UP", null]]],
    ["1 success after an outage: still DOWN", [false, false, false, true], [["DEGRADED", null], ["DEGRADED", null], ["DOWN", "INCIDENT_OPENED"], ["DOWN", null]]],
    ["2 successes after an outage: UP and incident closed", [false, false, false, true, true], [["DEGRADED", null], ["DEGRADED", null], ["DOWN", "INCIDENT_OPENED"], ["DOWN", null], ["UP", "INCIDENT_CLOSED"]]],
    ["flapping line stays DOWN instead of reopening incidents", [false, false, false, true, false, true, false], [["DEGRADED", null], ["DEGRADED", null], ["DOWN", "INCIDENT_OPENED"], ["DOWN", null], ["DOWN", null], ["DOWN", null], ["DOWN", null]]],
  ])("%s", (_name, results, expected) => {
    expect(run(results)).toEqual(expected);
  });

  it("ignores a measurement not newer than the last one", () => {
    const measuredAt = new Date("2026-10-20T09:41:00Z");
    const state: AgencyState = { ...initial, lastMeasuredAt: measuredAt };
    expect(next(state, { measuredAt, success: false, rttMs: null }, thresholds)).toEqual({ stale: true });
    expect(next(state, { measuredAt: new Date("2026-10-20T09:40:00Z"), success: false, rttMs: null }, thresholds)).toEqual({ stale: true });
  });

  it("records the latency of a success and clears it on a failure", () => {
    const ok = next(initial, { measuredAt: new Date("2026-10-20T09:40:00Z"), success: true, rttMs: 18.5 }, thresholds);
    expect(!ok.stale && ok.state.lastRttMs).toBe(18.5);
    if (ok.stale) return;
    const ko = next(ok.state, { measuredAt: new Date("2026-10-20T09:41:00Z"), success: false, rttMs: null }, thresholds);
    expect(!ko.stale && ko.state.lastRttMs).toBeNull();
  });
});
