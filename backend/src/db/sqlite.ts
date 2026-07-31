import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

export type SqliteDatabase = Database.Database;

export function createSqliteDatabase(
  databasePath = process.env.DATABASE_PATH ?? "./data/account-manager.sqlite",
): SqliteDatabase {
  const resolvedPath = databasePath === ":memory:" ? databasePath : resolve(databasePath);
  if (resolvedPath !== ":memory:") mkdirSync(dirname(resolvedPath), { recursive: true });

  const database = new Database(resolvedPath);
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  return database;
}
