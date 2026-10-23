import { connectPostgres, connectRedis } from "@bnm/shared";
import type { FastifyInstance } from "fastify";
import type { Config } from "../config/config.js";
import { createIncidentsRepository } from "../incidents/repository/incidents.js";
import { createIncidentsService } from "../incidents/service/incidents.js";
import { createMeasurementsService } from "../measurements/service/measurements.js";
import { buildRouter } from "../router/router.js";
import { createStatusRepository } from "../status/repository/status.js";
import { createStatusService } from "../status/service/status.js";

// Composition root: the only place that knows how the pieces fit together.
export async function createServer(config: Config): Promise<FastifyInstance> {
  const pool = await connectPostgres(config.databaseUrl);
  const redis = await connectRedis(config.redisUrl);

  const app = buildRouter(
    {
      collectorApiKey: config.collectorApiKey,
      measurements: createMeasurementsService(redis),
      status: createStatusService(createStatusRepository(pool)),
      incidents: createIncidentsService(createIncidentsRepository(pool)),
    },
    { logger: true },
  );

  app.addHook("onClose", async () => {
    await redis.quit();
    await pool.end();
  });
  return app;
}
