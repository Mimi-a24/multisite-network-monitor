import type { FastifyInstance } from "fastify";
import { measurementsHandler } from "../measurements/handler/measurements.js";
import type { MeasurementsService } from "../measurements/service/measurements.js";
import { apiKeyHook } from "./api-key.js";

export function registerMeasurementRoutes(app: FastifyInstance, service: MeasurementsService, apiKey: string): void {
  app.post("/v1/measurements", { onRequest: apiKeyHook(apiKey) }, measurementsHandler(service));
}
