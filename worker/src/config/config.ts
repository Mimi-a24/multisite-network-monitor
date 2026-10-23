import { loadEnv, positiveInt, required } from "@bnm/shared";
import { z } from "zod";

const schema = z
  .object({
    DATABASE_URL: required,
    REDIS_URL: required,
    FAILURES_TO_OPEN: positiveInt(3),
    SUCCESSES_TO_CLOSE: positiveInt(2),
    WORKER_NAME: z.string().trim().min(1).default("worker-1"),
  })
  .transform((env) => ({
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    thresholds: { failuresToOpen: env.FAILURES_TO_OPEN, successesToClose: env.SUCCESSES_TO_CLOSE },
    workerName: env.WORKER_NAME,
  }));

export type Config = z.infer<typeof schema>;

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => loadEnv(schema, env);
