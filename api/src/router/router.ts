import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import type { IncidentsService } from "../incidents/service/incidents.js";
import type { MeasurementsService } from "../measurements/service/measurements.js";
import type { StatusService } from "../status/service/status.js";
import { registerHealthRoutes } from "./health.js";
import { registerIncidentRoutes } from "./incidents.js";
import { registerMeasurementRoutes } from "./measurements.js";
import { registerStatusRoutes } from "./status.js";

export interface RouterDeps {
  collectorApiKey: string;
  measurements: MeasurementsService;
  status: StatusService;
  incidents: IncidentsService;
}

export function buildRouter(deps: RouterDeps, options: { logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  // Client errors keep their message; server errors are logged, never leaked.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status < 500) return reply.code(status).send({ error: error.message });
    request.log.error({ err: error }, "request failed");
    return reply.code(500).send({ error: "internal error" });
  });

  registerHealthRoutes(app);
  registerMeasurementRoutes(app, deps.measurements, deps.collectorApiKey);
  registerStatusRoutes(app, deps.status);
  registerIncidentRoutes(app, deps.incidents);
  return app;
}
