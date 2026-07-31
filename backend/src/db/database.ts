import { databaseConfig } from "../config.js";
import { closePostgresPool, createPostgresPool, type PostgresPool } from "./postgres.js";
import { closeSqliteDatabase, createSqliteDatabase, type SqliteDatabase } from "./sqlite.js";

export type DatabaseConnection =
  | { dialect: "sqlite"; database: SqliteDatabase; close: () => Promise<void> }
  | { dialect: "postgres"; pool: PostgresPool; close: () => Promise<void> };

export function createDatabaseConnection(): DatabaseConnection {
  if (databaseConfig.url) {
    const pool = createPostgresPool();
    return { dialect: "postgres", pool, close: () => closePostgresPool(pool) };
  }

  const database = createSqliteDatabase();
  return { dialect: "sqlite", database, close: () => closeSqliteDatabase(database) };
}
