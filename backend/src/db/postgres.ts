import { Pool } from "pg";

export type PostgresPool = Pool;

export function createPostgresPool(connectionString = process.env.DATABASE_URL): PostgresPool {
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  return new Pool({ connectionString });
}
