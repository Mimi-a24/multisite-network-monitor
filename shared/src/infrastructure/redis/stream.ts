import type { Redis } from "ioredis";
import type { Measurement } from "../../contracts/measurement.js";

export const MEASUREMENTS_STREAM = "measurements";
export const WORKERS_GROUP = "workers";

export interface StreamMessage {
  id: string;
  data: string;
}

// MULTI makes the batch all-or-nothing: the API never answers 202 for a half-written batch.
export async function appendMeasurements(redis: Redis, measurements: Measurement[]): Promise<void> {
  const tx = redis.multi();
  for (const m of measurements) tx.xadd(MEASUREMENTS_STREAM, "*", "data", JSON.stringify(m));
  const results = await tx.exec();
  const failed = results?.find(([err]) => err);
  if (!results || failed) throw failed?.[0] ?? new Error("redis transaction aborted");
}

export async function ensureGroup(redis: Redis): Promise<void> {
  try {
    await redis.xgroup("CREATE", MEASUREMENTS_STREAM, WORKERS_GROUP, "0", "MKSTREAM");
  } catch (err) {
    if (!String(err).includes("BUSYGROUP")) throw err;
  }
}

// from "0": messages already delivered to this consumer but not acknowledged (crash recovery).
// from ">": new messages, waiting up to blockMs for some to arrive.
export async function readMessages(
  redis: Redis,
  consumer: string,
  from: "0" | ">",
  count: number,
  blockMs: number,
): Promise<StreamMessage[]> {
  const reply = (await redis.xreadgroup(
    "GROUP", WORKERS_GROUP, consumer,
    "COUNT", count,
    "BLOCK", blockMs,
    "STREAMS", MEASUREMENTS_STREAM, from,
  )) as [string, [string, string[]][]][] | null;

  const entries = reply?.[0]?.[1] ?? [];
  return entries.map(([id, fields]) => ({ id, data: fields[fields.indexOf("data") + 1] ?? "" }));
}

export async function ack(redis: Redis, id: string): Promise<void> {
  await redis.xack(MEASUREMENTS_STREAM, WORKERS_GROUP, id);
}
