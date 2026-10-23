import { ConfigError } from "@bnm/shared";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const base = { DATABASE_URL: "postgres://db", REDIS_URL: "redis://redis" };

describe("worker config", () => {
  it("applies the default thresholds", () => {
    expect(loadConfig(base).thresholds).toEqual({ failuresToOpen: 3, successesToClose: 2 });
  });

  it("falls back to the default when a threshold is blank", () => {
    expect(loadConfig({ ...base, FAILURES_TO_OPEN: "" }).thresholds.failuresToOpen).toBe(3);
  });

  it("reads custom thresholds", () => {
    const config = loadConfig({ ...base, FAILURES_TO_OPEN: "5", SUCCESSES_TO_CLOSE: "4" });
    expect(config.thresholds).toEqual({ failuresToOpen: 5, successesToClose: 4 });
  });

  it("reports every missing required value at once", () => {
    try {
      loadConfig({ REDIS_URL: " " });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).problems).toEqual([
        "DATABASE_URL is required and must not be empty",
        "REDIS_URL is required and must not be empty",
      ]);
    }
  });

  it("rejects a threshold that is not a positive integer", () => {
    expect(() => loadConfig({ ...base, FAILURES_TO_OPEN: "0" })).toThrow(ConfigError);
    expect(() => loadConfig({ ...base, FAILURES_TO_OPEN: "abc" })).toThrow(ConfigError);
  });
});
