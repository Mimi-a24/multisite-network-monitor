import type { FastifyInstance } from "fastify";
import { getStatusHandler, listStatusHandler } from "../status/handler/status.js";
import type { StatusService } from "../status/service/status.js";

export function registerStatusRoutes(app: FastifyInstance, service: StatusService): void {
  app.get("/v1/agencies", listStatusHandler(service));
  app.get("/v1/agencies/:id/status", getStatusHandler(service));
}
