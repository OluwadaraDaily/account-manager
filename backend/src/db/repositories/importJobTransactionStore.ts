import { createDatabaseConnection, type DatabaseConnection } from "../database.js";
import { createSqliteDatabase, type SqliteDatabase } from "../sqlite.js";
import type { PostgresPool } from "../postgres.js";

export interface ImportJobTransactionStore {
  link(googleSubject: string, bankId: string, jobId: string, transactionId: string): Promise<void>;
  listTransactionIds(googleSubject: string, bankId: string, jobId: string): Promise<string[]>;
  close(): Promise<void>;
}

function assertIdentifier(value: string, field: string) {
  if (!value.trim()) throw new Error(`${field} must not be empty.`);
}

function validateIdentifiers(
  googleSubject: string,
  bankId: string,
  jobId: string,
  transactionId?: string,
) {
  assertIdentifier(googleSubject, "googleSubject");
  assertIdentifier(bankId, "bankId");
  assertIdentifier(jobId, "jobId");
  if (transactionId !== undefined) assertIdentifier(transactionId, "transactionId");
}

export class SqliteImportJobTransactionStore implements ImportJobTransactionStore {
  private readonly database: SqliteDatabase;

  constructor(
    database: SqliteDatabase = createSqliteDatabase(),
    private readonly ownsDatabase = true,
  ) {
    this.database = database;
  }

  async link(googleSubject: string, bankId: string, jobId: string, transactionId: string) {
    validateIdentifiers(googleSubject, bankId, jobId, transactionId);
    this.database
      .prepare(
        `INSERT OR IGNORE INTO gmail_import_job_transactions
          (job_id, transaction_id, google_subject, bank_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(jobId, transactionId, googleSubject, bankId, new Date().toISOString());
  }

  async listTransactionIds(googleSubject: string, bankId: string, jobId: string) {
    validateIdentifiers(googleSubject, bankId, jobId);
    const rows = this.database
      .prepare(
        `SELECT transaction_id
         FROM gmail_import_job_transactions
         WHERE google_subject = ? AND bank_id = ? AND job_id = ?
         ORDER BY created_at, transaction_id`,
      )
      .all(googleSubject, bankId, jobId) as Array<{ transaction_id: string }>;

    return rows.map((row) => row.transaction_id);
  }

  async close() {
    if (this.ownsDatabase) this.database.close();
  }
}

export class PostgresImportJobTransactionStore implements ImportJobTransactionStore {
  constructor(
    private readonly pool: PostgresPool,
    private readonly ownsPool = true,
  ) {}

  async link(googleSubject: string, bankId: string, jobId: string, transactionId: string) {
    validateIdentifiers(googleSubject, bankId, jobId, transactionId);
    await this.pool.query(
      `INSERT INTO gmail_import_job_transactions
        (job_id, transaction_id, google_subject, bank_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (job_id, transaction_id) DO NOTHING`,
      [jobId, transactionId, googleSubject, bankId],
    );
  }

  async listTransactionIds(googleSubject: string, bankId: string, jobId: string) {
    validateIdentifiers(googleSubject, bankId, jobId);
    const result = await this.pool.query<{ transaction_id: string }>(
      `SELECT transaction_id
       FROM gmail_import_job_transactions
       WHERE google_subject = $1 AND bank_id = $2 AND job_id = $3
       ORDER BY created_at, transaction_id`,
      [googleSubject, bankId, jobId],
    );

    return result.rows.map((row) => row.transaction_id);
  }

  async close() {
    if (this.ownsPool) await this.pool.end();
  }
}

export async function createImportJobTransactionStore(
  connection?: DatabaseConnection,
): Promise<ImportJobTransactionStore> {
  const ownsConnection = !connection;
  const activeConnection = connection ?? createDatabaseConnection();

  if (activeConnection.dialect === "postgres") {
    return new PostgresImportJobTransactionStore(activeConnection.pool, ownsConnection);
  }

  return new SqliteImportJobTransactionStore(activeConnection.database, ownsConnection);
}
