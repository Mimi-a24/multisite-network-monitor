import { toIncidentDto } from "../dto/incident.js";
import type { IncidentsService } from "../service/incidents.js";

export function listIncidentsHandler(service: IncidentsService) {
  return async () => (await service.list()).map(toIncidentDto);
}
