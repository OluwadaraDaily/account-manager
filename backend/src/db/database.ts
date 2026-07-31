import { createPostgresPool, type PostgresPool } from "./postgres.js";
import { createSqliteDatabase, type SqliteDatabase } from "./sqlite.js";

export type DatabaseConnection =
  { dialect: "sqlite"; database: SqliteDatabase } | { dialect: "postgres"; pool: PostgresPool };

export function createDatabaseConnection(): DatabaseConnection {
  if (process.env.DATABASE_URL) {
    return { dialect: "postgres", pool: createPostgresPool() };
  }

  return { dialect: "sqlite", database: createSqliteDatabase() };
}
