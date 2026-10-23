import type { IncidentRow, IncidentsRepository } from "../repository/incidents.js";

// ponytail: fixed page of the 100 most recent; add cursor pagination when history outgrows it.
const LIMIT = 100;

export interface IncidentsService {
  list(): Promise<IncidentRow[]>;
}

export function createIncidentsService(repository: IncidentsRepository): IncidentsService {
  return { list: () => repository.list(LIMIT) };
}
