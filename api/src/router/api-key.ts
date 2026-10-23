import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

const digest = (value: string) => createHash("sha256").update(value).digest();

// Compares digests so the comparison takes the same time whatever the key's length or content.
export function apiKeyHook(expected: string) {
  const expectedDigest = digest(expected);
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const given = request.headers["x-api-key"];
    if (typeof given !== "string" || !timingSafeEqual(digest(given), expectedDigest)) {
      return reply.code(401).send({ error: "invalid api key" });
    }
  };
}
