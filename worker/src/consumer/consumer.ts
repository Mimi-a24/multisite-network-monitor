import { ack, ensureGroup, measurementSchema, readMessages, type Redis } from "@bnm/shared";
import type { Logger } from "pino";
import type { Processor } from "../service/processor.js";

const BATCH = 50;
const BLOCK_MS = 2000;
const RETRY_DELAY_MS = 1000;

export interface Consumer {
  run(): Promise<void>;
  stop(): void;
}

export function createConsumer(redis: Redis, name: string, process: Processor, log: Logger): Consumer {
  let stopped = false;

  async function handle(id: string, data: string): Promise<void> {
    let parsed;
    try {
      parsed = measurementSchema.safeParse(JSON.parse(data));
    } catch {
      parsed = null;
    }
    if (!parsed?.success) {
      // A malformed message will never become valid: acknowledge it so it can't block the stream.
      log.error({ message_id: id }, "malformed message dropped");
    } else {
      await process(parsed.data);
    }
    await ack(redis, id);
  }

  return {
    async run() {
      await ensureGroup(redis);
      // Start with what a previous run of this consumer received but never acknowledged.
      let pending = true;
      while (!stopped) {
        try {
          const messages = await readMessages(redis, name, pending ? "0" : ">", BATCH, BLOCK_MS);
          if (pending && messages.length === 0) pending = false;
          for (const m of messages) await handle(m.id, m.data);
        } catch (err) {
          if (stopped) break;
          // Nothing was acknowledged for the failed message: replay the pending list after a pause.
          log.error({ err }, "processing failed, retrying");
          pending = true;
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    },
    stop() {
      stopped = true;
    },
  };
}
