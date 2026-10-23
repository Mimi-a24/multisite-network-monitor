import pg from "pg";

export type Pool = pg.Pool;
export type PoolClient = pg.PoolClient;

export async function connectPostgres(url: string): Promise<pg.Pool> {
  const pool = new pg.Pool({ connectionString: url });
  await pool.query("SELECT 1");
  return pool;
}

export async function withTransaction<T>(pool: pg.Pool, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
