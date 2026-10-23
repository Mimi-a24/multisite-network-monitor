import type { FastifyReply, FastifyRequest } from "fastify";
import { toAgencyStatusDto } from "../dto/agency-status.js";
import type { StatusService } from "../service/status.js";

export function listStatusHandler(service: StatusService) {
  return async () => (await service.list()).map(toAgencyStatusDto);
}

export function getStatusHandler(service: StatusService) {
  return async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const row = await service.get(request.params.id);
    if (!row) return reply.code(404).send({ error: `unknown agency: ${request.params.id}` });
    return toAgencyStatusDto(row);
  };
}
