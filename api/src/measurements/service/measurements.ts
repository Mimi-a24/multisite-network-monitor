import { appendMeasurements, type Measurement, type Redis } from "@bnm/shared";

export interface MeasurementsService {
  enqueue(measurements: Measurement[]): Promise<void>;
}

// The API only queues; deciding whether a branch is down is the worker's job.
export function createMeasurementsService(redis: Redis): MeasurementsService {
  return { enqueue: (measurements) => appendMeasurements(redis, measurements) };
}
