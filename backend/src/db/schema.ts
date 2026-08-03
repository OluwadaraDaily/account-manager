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
    bank_id TEXT,
    search_mode TEXT NOT NULL DEFAULT 'sender'
      CHECK (search_mode IN ('sender', 'bank-fallback')),
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

const bankDirectorySchema = `
  CREATE TABLE IF NOT EXISTS bank_directory (
    bank_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    aliases_json TEXT NOT NULL,
    licence_category TEXT NOT NULL,
    official_domains_json TEXT NOT NULL,
    customer_service_emails_json TEXT NOT NULL,
    candidate_contact_emails_json TEXT NOT NULL,
    transaction_notification_sender_email TEXT,
    search_terms_json TEXT NOT NULL,
    status TEXT NOT NULL,
    verification_status TEXT NOT NULL,
    sources_json TEXT NOT NULL,
    checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  )
`;

export async function initializeDatabase(connection: DatabaseConnection) {
  if (connection.dialect === "postgres") {
    await connection.pool.query(sessionSchema);
    await connection.pool.query(refreshTokenSchema);
    await connection.pool.query(importJobSchema);
    await connection.pool.query(bankDirectorySchema);
    await connection.pool.query(
      "ALTER TABLE gmail_import_jobs ADD COLUMN IF NOT EXISTS bank_id TEXT",
    );
    await connection.pool.query(
      "ALTER TABLE gmail_import_jobs ADD COLUMN IF NOT EXISTS search_mode TEXT NOT NULL DEFAULT 'sender'",
    );
    return;
  }

  connection.database.exec(sessionSchema.replaceAll("TIMESTAMPTZ", "TEXT"));
  connection.database.exec(refreshTokenSchema.replaceAll("TIMESTAMPTZ", "TEXT"));
  connection.database.exec(importJobSchema.replaceAll("TIMESTAMPTZ", "TEXT"));
  connection.database.exec(bankDirectorySchema.replaceAll("TIMESTAMPTZ", "TEXT"));

  const columns = connection.database
    .prepare("PRAGMA table_info(gmail_import_jobs)")
    .all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "bank_id")) {
    connection.database.exec("ALTER TABLE gmail_import_jobs ADD COLUMN bank_id TEXT");
  }
  if (!columns.some((column) => column.name === "search_mode")) {
    connection.database.exec(
      "ALTER TABLE gmail_import_jobs ADD COLUMN search_mode TEXT NOT NULL DEFAULT 'sender'",
    );
  }
}
