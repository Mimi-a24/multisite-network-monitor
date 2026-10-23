import { measurementBatchSchema } from "@bnm/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { MeasurementsService } from "../service/measurements.js";

export function measurementsHandler(service: MeasurementsService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = measurementBatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body", details: z.flattenError(parsed.error) });
    }
    await service.enqueue(parsed.data.measurements);
    return reply.code(202).send({ accepted: parsed.data.measurements.length });
  };
}
