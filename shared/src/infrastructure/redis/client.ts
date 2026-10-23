import { Redis } from "ioredis";

export type { Redis };

export async function connectRedis(url: string): Promise<Redis> {
  const redis = new Redis(url, { lazyConnect: true });
  await redis.connect();
  return redis;
}
