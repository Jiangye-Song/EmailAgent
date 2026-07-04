import type { PoolClient } from "pg";
import { pool } from "@/lib/db";

export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ROLLBACK failure does not mask the original error
    }
    throw error;
  } finally {
    client.release();
  }
}
