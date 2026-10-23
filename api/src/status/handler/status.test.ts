import { describe, expect, it } from "vitest";
import { buildRouter } from "../../router/router.js";
import type { AgencyStatusRow } from "../repository/status.js";

const rows: AgencyStatusRow[] = [
  {
    id: "saint-paul",
    name: "Agence Saint-Paul",
    status: "UP",
    last_rtt_ms: "18.50",
    last_measured_at: new Date("2026-10-20T09:43:00Z"),
    incident_ref: null,
    incident_opened_at: null,
  },
  {
    id: "saint-pierre",
    name: "Agence Saint-Pierre",
    status: "DOWN",
    last_rtt_ms: null,
    last_measured_at: new Date("2026-10-20T09:43:00Z"),
    incident_ref: "INC-0001",
    incident_opened_at: new Date("2026-10-20T09:43:00Z"),
  },
];

const app = buildRouter({
  collectorApiKey: "key",
  measurements: { enqueue: async () => {} },
  status: { list: async () => rows, get: async (id) => rows.find((r) => r.id === id) ?? null },
  incidents: { list: async () => [] },
});

describe("status routes", () => {
  it("GET /v1/agencies/:id/status returns the branch with its open incident", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/agencies/saint-pierre/status" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: "saint-pierre",
      name: "Agence Saint-Pierre",
      status: "DOWN",
      last_rtt_ms: null,
      last_measured_at: "2026-10-20T09:43:00.000Z",
      open_incident: { ref: "INC-0001", opened_at: "2026-10-20T09:43:00.000Z" },
    });
  });

  it("GET /v1/agencies lists every branch, latency as a number", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/agencies" });
    expect(res.statusCode).toBe(200);
    expect(res.json().map((a: { id: string; last_rtt_ms: number | null }) => [a.id, a.last_rtt_ms])).toEqual([
      ["saint-paul", 18.5],
      ["saint-pierre", null],
    ]);
  });

  it("answers 404 for an unknown branch", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/agencies/nowhere/status" });
    expect(res.statusCode).toBe(404);
  });
});
