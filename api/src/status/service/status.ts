import type { AgencyStatusRow, StatusRepository } from "../repository/status.js";

export interface StatusService {
  list(): Promise<AgencyStatusRow[]>;
  get(agencyId: string): Promise<AgencyStatusRow | null>;
}

export function createStatusService(repository: StatusRepository): StatusService {
  return {
    list: () => repository.find(),
    get: async (agencyId) => (await repository.find(agencyId))[0] ?? null,
  };
}
