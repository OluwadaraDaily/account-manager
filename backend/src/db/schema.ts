import type { DatabaseConnection } from "./database.js";

const refreshTokenSchema = `
  CREATE TABLE IF NOT EXISTS google_refresh_tokens (
    google_subject TEXT PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    ciphertext TEXT NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    key_version INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  )
`;

const sessionSchema = `
  CREATE TABLE IF NOT EXISTS auth_sessions (
    session_hash TEXT PRIMARY KEY,
    google_subject TEXT NOT NULL,
    email TEXT,
    display_name TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
  )
`;

export async function initializeDatabase(connection: DatabaseConnection) {
  if (connection.dialect === "postgres") {
    await connection.pool.query(sessionSchema);
    await connection.pool.query(refreshTokenSchema);
    return;
  }

  connection.database.exec(sessionSchema.replaceAll("TIMESTAMPTZ", "TEXT"));
  connection.database.exec(refreshTokenSchema.replaceAll("TIMESTAMPTZ", "TEXT"));
}
