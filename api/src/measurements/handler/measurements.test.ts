import type { Measurement } from "@bnm/shared";
import { describe, expect, it } from "vitest";
import { buildRouter } from "../../router/router.js";

const KEY = "test-key";

function setup() {
  const enqueued: Measurement[][] = [];
  const app = buildRouter({
    collectorApiKey: KEY,
    measurements: { enqueue: async (batch) => void enqueued.push(batch) },
    status: { list: async () => [], get: async () => null },
    incidents: { list: async () => [] },
  });
  return { app, enqueued };
}

const measurement = {
  id: "0b8f8a52-4a8e-4c0e-9d5e-2f3f1c6b9a10",
  agency_id: "saint-pierre",
  measured_at: "2026-10-20T09:41:00Z",
  success: false,
  rtt_ms: null,
};

const post = (app: ReturnType<typeof setup>["app"], body: unknown, key: string | null = KEY) =>
  app.inject({
    method: "POST",
    url: "/v1/measurements",
    headers: key === null ? {} : { "x-api-key": key },
    payload: body as object,
  });

describe("POST /v1/measurements", () => {
  it("queues a valid batch and answers 202", async () => {
    const { app, enqueued } = setup();
    const res = await post(app, { measurements: [measurement] });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ accepted: 1 });
    expect(enqueued).toEqual([[measurement]]);
  });

  it("accepts a timestamp with an offset, as Python sends it", async () => {
    const { app } = setup();
    const res = await post(app, { measurements: [{ ...measurement, measured_at: "2026-10-20T09:41:00.123456+00:00" }] });
    expect(res.statusCode).toBe(202);
  });

  it.each([
    ["an empty batch", { measurements: [] }],
    ["a missing field", { measurements: [{ ...measurement, success: undefined }] }],
    ["an id that is not a UUID", { measurements: [{ ...measurement, id: "42" }] }],
    ["a latency on a failed ping", { measurements: [{ ...measurement, rtt_ms: 12 }] }],
    ["a negative latency", { measurements: [{ ...measurement, success: true, rtt_ms: -1 }] }],
  ])("answers 400 for %s", async (_name, body) => {
    const { app, enqueued } = setup();
    const res = await post(app, body);
    expect(res.statusCode).toBe(400);
    expect(enqueued).toEqual([]);
  });

  it.each([
    ["no key", null],
    ["a wrong key", "wrong"],
  ])("answers 401 with %s", async (_name, key) => {
    const { app, enqueued } = setup();
    const res = await post(app, { measurements: [measurement] }, key);
    expect(res.statusCode).toBe(401);
    expect(enqueued).toEqual([]);
  });
});
