import { Pool } from "pg";
import { databaseConfig } from "../config.js";

export type PostgresPool = Pool;

export function createPostgresPool(connectionString = databaseConfig.url): PostgresPool {
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  return new Pool({ connectionString });
}

export function closePostgresPool(pool: PostgresPool) {
  return pool.end();
}
