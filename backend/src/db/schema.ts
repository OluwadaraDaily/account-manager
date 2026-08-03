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

const importJobSchema = `
  CREATE TABLE IF NOT EXISTS gmail_import_jobs (
    job_id TEXT PRIMARY KEY,
    google_subject TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    sender_email TEXT,
    after_timestamp INTEGER,
    before_timestamp INTEGER,
    subject TEXT,
    keyword TEXT,
    page_token TEXT,
    messages_discovered INTEGER NOT NULL DEFAULT 0,
    messages_processed INTEGER NOT NULL DEFAULT 0,
    transactions_extracted INTEGER NOT NULL DEFAULT 0,
    messages_skipped INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
  )
`;

export async function initializeDatabase(connection: DatabaseConnection) {
  if (connection.dialect === "postgres") {
    await connection.pool.query(sessionSchema);
    await connection.pool.query(refreshTokenSchema);
    await connection.pool.query(importJobSchema);
    return;
  }

  connection.database.exec(sessionSchema.replaceAll("TIMESTAMPTZ", "TEXT"));
  connection.database.exec(refreshTokenSchema.replaceAll("TIMESTAMPTZ", "TEXT"));
  connection.database.exec(importJobSchema.replaceAll("TIMESTAMPTZ", "TEXT"));
}
