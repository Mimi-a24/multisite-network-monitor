import { withTransaction, type Measurement, type Pool } from "@bnm/shared";
import type { Logger } from "pino";
import { closeIncident, lockState, openIncident, saveState } from "../repository/monitoring.js";
import { next, type Thresholds } from "./state-machine.js";

export type Processor = (measurement: Measurement) => Promise<void>;

// State update and incident change commit together, or not at all.
// The caller acknowledges the message only after this resolves.
export function createProcessor(pool: Pool, thresholds: Thresholds, log: Logger): Processor {
  return (m) =>
    withTransaction(pool, async (client) => {
      const state = await lockState(client, m.agency_id);
      if (!state) {
        log.warn({ agency_id: m.agency_id, measurement_id: m.id }, "unknown agency, measurement dropped");
        return;
      }

      const probe = { measuredAt: new Date(m.measured_at), success: m.success, rttMs: m.rtt_ms };
      const t = next(state, probe, thresholds);
      if (t.stale) {
        log.info({ agency_id: m.agency_id, measurement_id: m.id }, "stale measurement ignored");
        return;
      }

      await saveState(client, m.agency_id, t.state);
      if (t.state.status !== state.status) {
        log.info({ agency_id: m.agency_id, from: state.status, to: t.state.status }, "status changed");
      }
      if (t.event === "INCIDENT_OPENED") {
        const ref = await openIncident(client, m.agency_id, probe.measuredAt);
        log.warn({ agency_id: m.agency_id, incident: ref }, "incident opened");
      } else if (t.event === "INCIDENT_CLOSED") {
        const ref = await closeIncident(client, m.agency_id, probe.measuredAt);
        log.info({ agency_id: m.agency_id, incident: ref }, "incident closed");
      }
    });
}
