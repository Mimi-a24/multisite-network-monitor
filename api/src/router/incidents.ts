import type { FastifyInstance } from "fastify";
import { listIncidentsHandler } from "../incidents/handler/incidents.js";
import type { IncidentsService } from "../incidents/service/incidents.js";

export function registerIncidentRoutes(app: FastifyInstance, service: IncidentsService): void {
  app.get("/v1/incidents", listIncidentsHandler(service));
}
