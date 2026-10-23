import { connectPostgres, connectRedis } from "@bnm/shared";
import { pino } from "pino";
import { loadConfig } from "./config/config.js";
import { createConsumer } from "./consumer/consumer.js";
import { createProcessor } from "./service/processor.js";

const log = pino({ name: "worker" });

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = await connectPostgres(config.databaseUrl);
  const redis = await connectRedis(config.redisUrl);

  const consumer = createConsumer(redis, config.workerName, createProcessor(pool, config.thresholds, log), log);

  const shutdown = () => {
    log.info("shutting down");
    consumer.stop();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  log.info({ consumer: config.workerName, thresholds: config.thresholds }, "worker started");
  await consumer.run();

  await redis.quit();
  await pool.end();
}

main().catch((err) => {
  log.fatal({ err }, err instanceof Error ? err.message : "worker failed");
  process.exit(1);
});
