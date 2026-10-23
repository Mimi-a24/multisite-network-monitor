import { z } from "zod";

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`invalid configuration: ${problems.join("; ")}`);
  }
}

// A required value has no safe default: missing or blank is an error.
export const required = z
  .string({ error: "is required and must not be empty" })
  .trim()
  .min(1, "is required and must not be empty");

// An optional number falls back to its default when unset or blank.
export const positiveInt = (fallback: number) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().default(fallback),
  );

// Validates the environment against the schema and reports every problem at once.
export function loadEnv<T extends z.ZodType>(schema: T, env: NodeJS.ProcessEnv = process.env): z.infer<T> {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new ConfigError(result.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`));
  }
  return result.data;
}
