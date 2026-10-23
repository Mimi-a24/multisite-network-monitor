import { loadEnv, positiveInt, required } from "@bnm/shared";
import { z } from "zod";

const schema = z
  .object({
    API_PORT: positiveInt(3000),
    DATABASE_URL: required,
    REDIS_URL: required,
    COLLECTOR_API_KEY: required,
  })
  .transform((env) => ({
    port: env.API_PORT,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    collectorApiKey: env.COLLECTOR_API_KEY,
  }));

export type Config = z.infer<typeof schema>;

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => loadEnv(schema, env);
