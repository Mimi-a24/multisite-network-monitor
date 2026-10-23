import { z } from "zod";

// The wire format of one probe result: validated by the API, parsed again by the worker.
export const measurementSchema = z
  .object({
    id: z.uuid(),
    agency_id: z.string().min(1),
    measured_at: z.iso.datetime({ offset: true }),
    success: z.boolean(),
    rtt_ms: z.number().nonnegative().nullable(),
  })
  .refine((m) => m.success || m.rtt_ms === null, {
    message: "must be null when success is false",
    path: ["rtt_ms"],
  });

export const measurementBatchSchema = z.object({
  measurements: z.array(measurementSchema).min(1).max(1000),
});

export type Measurement = z.infer<typeof measurementSchema>;
