import { ConfigError } from "@bnm/shared";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const base = { DATABASE_URL: "postgres://db", REDIS_URL: "redis://redis", COLLECTOR_API_KEY: "secret" };

describe("api config", () => {
  it("defaults the port to 3000", () => {
    expect(loadConfig(base).port).toBe(3000);
  });

  it("reads every value", () => {
    expect(loadConfig({ ...base, API_PORT: "8080" })).toEqual({
      port: 8080,
      databaseUrl: "postgres://db",
      redisUrl: "redis://redis",
      collectorApiKey: "secret",
    });
  });

  it("refuses to start without a collector key", () => {
    expect(() => loadConfig({ ...base, COLLECTOR_API_KEY: "" })).toThrow(
      new ConfigError(["COLLECTOR_API_KEY is required and must not be empty"]),
    );
  });
});
