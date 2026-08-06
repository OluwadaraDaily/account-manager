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

const normalizedTransactionSchema = `
  CREATE TABLE IF NOT EXISTS normalized_transactions (
    transaction_id TEXT PRIMARY KEY,
    google_subject TEXT NOT NULL,
    bank_id TEXT NOT NULL,
    source_message_id TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    transaction_date TEXT,
    direction TEXT CHECK (direction IN ('debit', 'credit') OR direction IS NULL),
    amount TEXT,
    currency TEXT,
    counterparty TEXT,
    description TEXT,
    channel TEXT,
    confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    review_reasons_json TEXT NOT NULL,
    review_status TEXT NOT NULL CHECK (review_status IN ('ready', 'needs-review', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (google_subject, bank_id, source_message_id)
  )
`;

const importJobTransactionSchema = `
  CREATE TABLE IF NOT EXISTS gmail_import_job_transactions (
    job_id TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    google_subject TEXT NOT NULL,
    bank_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (job_id, transaction_id),
    FOREIGN KEY (job_id) REFERENCES gmail_import_jobs(job_id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES normalized_transactions(transaction_id) ON DELETE CASCADE
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
    await connection.pool.query(normalizedTransactionSchema);
    await connection.pool.query(importJobTransactionSchema);
    await connection.pool.query(
      "ALTER TABLE normalized_transactions ADD COLUMN IF NOT EXISTS confidence TEXT NOT NULL DEFAULT 'low'",
    );
    await connection.pool.query(
      "ALTER TABLE normalized_transactions ADD COLUMN IF NOT EXISTS review_reasons_json TEXT NOT NULL DEFAULT '[]'",
    );
    await connection.pool.query(
      "ALTER TABLE normalized_transactions ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'needs-review'",
    );
    await connection.pool.query(
      "ALTER TABLE normalized_transactions DROP CONSTRAINT IF EXISTS normalized_transactions_review_status_check",
    );
    await connection.pool.query(
      "ALTER TABLE normalized_transactions ADD CONSTRAINT normalized_transactions_review_status_check CHECK (review_status IN ('ready', 'needs-review', 'dismissed'))",
    );
    await connection.pool.query(
      "ALTER TABLE normalized_transactions ADD COLUMN IF NOT EXISTS fingerprint TEXT NOT NULL DEFAULT ''",
    );
    await connection.pool.query(
      "CREATE INDEX IF NOT EXISTS normalized_transactions_fingerprint_idx ON normalized_transactions (google_subject, bank_id, fingerprint)",
    );
    await connection.pool.query(
      "CREATE INDEX IF NOT EXISTS normalized_transactions_review_status_idx ON normalized_transactions (google_subject, bank_id, review_status)",
    );
    await connection.pool.query(bankDirectorySchema);
    await connection.pool.query(
      "ALTER TABLE gmail_import_jobs ADD COLUMN IF NOT EXISTS bank_id TEXT",
    );
    await connection.pool.query(
      "ALTER TABLE gmail_import_jobs ADD COLUMN IF NOT EXISTS search_mode TEXT NOT NULL DEFAULT 'sender'",
    );
    await connection.pool.query(
      "CREATE INDEX IF NOT EXISTS gmail_import_jobs_user_bank_created_idx ON gmail_import_jobs (google_subject, bank_id, created_at DESC, job_id DESC)",
    );
    await connection.pool.query(
      "CREATE INDEX IF NOT EXISTS gmail_import_job_transactions_user_bank_job_idx ON gmail_import_job_transactions (google_subject, bank_id, job_id, transaction_id)",
    );
    return;
  }

  connection.database.exec(sessionSchema.replaceAll("TIMESTAMPTZ", "TEXT"));
  connection.database.exec(refreshTokenSchema.replaceAll("TIMESTAMPTZ", "TEXT"));
  connection.database.exec(importJobSchema.replaceAll("TIMESTAMPTZ", "TEXT"));
  connection.database.exec(normalizedTransactionSchema.replaceAll("TIMESTAMPTZ", "TEXT"));
  const transactionColumns = connection.database
    .prepare("PRAGMA table_info(normalized_transactions)")
    .all() as Array<{ name: string }>;
  if (!transactionColumns.some((column) => column.name === "confidence")) {
    connection.database.exec(
      "ALTER TABLE normalized_transactions ADD COLUMN confidence TEXT NOT NULL DEFAULT 'low'",
    );
  }
  if (!transactionColumns.some((column) => column.name === "review_reasons_json")) {
    connection.database.exec(
      "ALTER TABLE normalized_transactions ADD COLUMN review_reasons_json TEXT NOT NULL DEFAULT '[]'",
    );
  }
  if (!transactionColumns.some((column) => column.name === "review_status")) {
    connection.database.exec(
      "ALTER TABLE normalized_transactions ADD COLUMN review_status TEXT NOT NULL DEFAULT 'needs-review'",
    );
  }
  if (!transactionColumns.some((column) => column.name === "fingerprint")) {
    connection.database.exec(
      "ALTER TABLE normalized_transactions ADD COLUMN fingerprint TEXT NOT NULL DEFAULT ''",
    );
  }
  const transactionTable = connection.database
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'normalized_transactions'",
    )
    .get() as { sql?: string } | undefined;
  if (!transactionTable?.sql?.includes("'dismissed'")) {
    const migratedTransactionSchema = normalizedTransactionSchema
      .replace("normalized_transactions", "normalized_transactions_migrated")
      .replaceAll("TIMESTAMPTZ", "TEXT");

    connection.database.exec("BEGIN IMMEDIATE");
    try {
      connection.database.exec(migratedTransactionSchema);
      connection.database.exec(
        `INSERT INTO normalized_transactions_migrated (
          transaction_id, google_subject, bank_id, source_message_id, fingerprint,
          transaction_date, direction, amount, currency, counterparty, description, channel,
          confidence, review_reasons_json, review_status, created_at, updated_at
        )
        SELECT
          transaction_id, google_subject, bank_id, source_message_id, fingerprint,
          transaction_date, direction, amount, currency, counterparty, description, channel,
          confidence, review_reasons_json, review_status, created_at, updated_at
        FROM normalized_transactions`,
      );
      connection.database.exec("DROP TABLE normalized_transactions");
      connection.database.exec(
        "ALTER TABLE normalized_transactions_migrated RENAME TO normalized_transactions",
      );
      connection.database.exec("COMMIT");
    } catch (error) {
      connection.database.exec("ROLLBACK");
      throw error;
    }
  }
  connection.database.exec(
    "CREATE INDEX IF NOT EXISTS normalized_transactions_fingerprint_idx ON normalized_transactions (google_subject, bank_id, fingerprint)",
  );
  connection.database.exec(
    "CREATE INDEX IF NOT EXISTS normalized_transactions_review_status_idx ON normalized_transactions (google_subject, bank_id, review_status)",
  );
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
  connection.database.exec(
    "CREATE INDEX IF NOT EXISTS gmail_import_jobs_user_bank_created_idx ON gmail_import_jobs (google_subject, bank_id, created_at DESC, job_id DESC)",
  );
  connection.database.exec(importJobTransactionSchema.replaceAll("TIMESTAMPTZ", "TEXT"));
  connection.database.exec(
    "CREATE INDEX IF NOT EXISTS gmail_import_job_transactions_user_bank_job_idx ON gmail_import_job_transactions (google_subject, bank_id, job_id, transaction_id)",
  );
}
