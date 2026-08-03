import { randomUUID } from "node:crypto";
import { createDatabaseConnection, type DatabaseConnection } from "../database.js";
import { createSqliteDatabase, type SqliteDatabase } from "../sqlite.js";
import type { PostgresPool } from "../postgres.js";

export type ImportJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type ImportSearchMode = "sender" | "bank-fallback";

export type ImportJobCriteria = {
  bankId: string | null;
  searchMode: ImportSearchMode;
  senderEmail: string | null;
  after: number | null;
  before: number | null;
  subject: string | null;
  keyword: string | null;
};

export type ImportJob = {
  id: string;
  googleSubject: string;
  status: ImportJobStatus;
  criteria: ImportJobCriteria;
  pageToken: string | null;
  progress: {
    messagesDiscovered: number;
    messagesProcessed: number;
    transactionsExtracted: number;
    messagesSkipped: number;
  };
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type ImportJobUpdate = {
  status?: ImportJobStatus;
  pageToken?: string | null;
  messagesDiscovered?: number;
  messagesProcessed?: number;
  transactionsExtracted?: number;
  messagesSkipped?: number;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

export interface ImportJobStore {
  create(googleSubject: string, criteria: ImportJobCriteria): Promise<ImportJob>;
  get(jobId: string, googleSubject: string): Promise<ImportJob | null>;
  update(jobId: string, googleSubject: string, changes: ImportJobUpdate): Promise<ImportJob | null>;
  close(): Promise<void>;
}

type ImportJobRow = {
  job_id: string;
  google_subject: string;
  status: ImportJobStatus;
  bank_id: string | null;
  search_mode: ImportSearchMode;
  sender_email: string | null;
  after_timestamp: number | null;
  before_timestamp: number | null;
  subject: string | null;
  keyword: string | null;
  page_token: string | null;
  messages_discovered: number;
  messages_processed: number;
  transactions_extracted: number;
  messages_skipped: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
};

function toImportJob(row: ImportJobRow): ImportJob {
  return {
    id: row.job_id,
    googleSubject: row.google_subject,
    status: row.status,
    criteria: {
      bankId: row.bank_id,
      searchMode: row.search_mode,
      senderEmail: row.sender_email,
      after: row.after_timestamp,
      before: row.before_timestamp,
      subject: row.subject,
      keyword: row.keyword,
    },
    pageToken: row.page_token,
    progress: {
      messagesDiscovered: row.messages_discovered,
      messagesProcessed: row.messages_processed,
      transactionsExtracted: row.transactions_extracted,
      messagesSkipped: row.messages_skipped,
    },
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function assertNonNegative(value: number, field: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer.`);
  }
}

function getColumns() {
  return `
    job_id, google_subject, status, bank_id, search_mode, sender_email,
    after_timestamp, before_timestamp,
    subject, keyword, page_token, messages_discovered, messages_processed,
    transactions_extracted, messages_skipped, error_message, created_at, updated_at,
    started_at, completed_at`;
}

export class SqliteImportJobStore implements ImportJobStore {
  private readonly database: SqliteDatabase;

  constructor(
    database: SqliteDatabase = createSqliteDatabase(),
    private readonly ownsDatabase = true,
  ) {
    this.database = database;
  }

  async create(googleSubject: string, criteria: ImportJobCriteria) {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.database
      .prepare(
        `INSERT INTO gmail_import_jobs
          (job_id, google_subject, status, bank_id, search_mode, sender_email,
           after_timestamp, before_timestamp,
           subject, keyword, created_at, updated_at)
         VALUES (?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        googleSubject,
        criteria.bankId,
        criteria.searchMode,
        criteria.senderEmail,
        criteria.after,
        criteria.before,
        criteria.subject,
        criteria.keyword,
        now,
        now,
      );

    return (await this.get(id, googleSubject)) as ImportJob;
  }

  async get(jobId: string, googleSubject: string) {
    const row = this.database
      .prepare(
        `SELECT ${getColumns()} FROM gmail_import_jobs WHERE job_id = ? AND google_subject = ?`,
      )
      .get(jobId, googleSubject) as ImportJobRow | undefined;

    return row ? toImportJob(row) : null;
  }

  async update(jobId: string, googleSubject: string, changes: ImportJobUpdate) {
    const assignments: string[] = [];
    const values: unknown[] = [];

    const addChange = (column: string, value: unknown) => {
      assignments.push(`${column} = ?`);
      values.push(value);
    };

    if (changes.status !== undefined) addChange("status", changes.status);
    if (changes.pageToken !== undefined) addChange("page_token", changes.pageToken);
    if (changes.messagesDiscovered !== undefined) {
      assertNonNegative(changes.messagesDiscovered, "messagesDiscovered");
      addChange("messages_discovered", changes.messagesDiscovered);
    }
    if (changes.messagesProcessed !== undefined) {
      assertNonNegative(changes.messagesProcessed, "messagesProcessed");
      addChange("messages_processed", changes.messagesProcessed);
    }
    if (changes.transactionsExtracted !== undefined) {
      assertNonNegative(changes.transactionsExtracted, "transactionsExtracted");
      addChange("transactions_extracted", changes.transactionsExtracted);
    }
    if (changes.messagesSkipped !== undefined) {
      assertNonNegative(changes.messagesSkipped, "messagesSkipped");
      addChange("messages_skipped", changes.messagesSkipped);
    }
    if (changes.errorMessage !== undefined) addChange("error_message", changes.errorMessage);
    if (changes.startedAt !== undefined) addChange("started_at", changes.startedAt);
    if (changes.completedAt !== undefined) addChange("completed_at", changes.completedAt);

    if (assignments.length === 0) throw new Error("At least one import job change is required.");

    assignments.push("updated_at = ?");
    values.push(new Date().toISOString(), jobId, googleSubject);
    const result = this.database
      .prepare(
        `UPDATE gmail_import_jobs
         SET ${assignments.join(", ")}
         WHERE job_id = ? AND google_subject = ?`,
      )
      .run(...values);

    return result.changes === 0 ? null : this.get(jobId, googleSubject);
  }

  async close() {
    if (this.ownsDatabase) this.database.close();
  }
}

export class PostgresImportJobStore implements ImportJobStore {
  constructor(
    private readonly pool: PostgresPool,
    private readonly ownsPool = true,
  ) {}

  async create(googleSubject: string, criteria: ImportJobCriteria) {
    const id = randomUUID();
    const result = await this.pool.query<ImportJobRow>(
      `INSERT INTO gmail_import_jobs
        (job_id, google_subject, status, bank_id, search_mode, sender_email,
         after_timestamp, before_timestamp,
         subject, keyword, created_at, updated_at)
       VALUES ($1, $2, 'queued', $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING ${getColumns()}`,
      [
        id,
        googleSubject,
        criteria.bankId,
        criteria.searchMode,
        criteria.senderEmail,
        criteria.after,
        criteria.before,
        criteria.subject,
        criteria.keyword,
      ],
    );

    return toImportJob(result.rows[0]);
  }

  async get(jobId: string, googleSubject: string) {
    const result = await this.pool.query<ImportJobRow>(
      `SELECT ${getColumns()} FROM gmail_import_jobs WHERE job_id = $1 AND google_subject = $2`,
      [jobId, googleSubject],
    );

    return result.rows[0] ? toImportJob(result.rows[0]) : null;
  }

  async update(jobId: string, googleSubject: string, changes: ImportJobUpdate) {
    const assignments: string[] = [];
    const values: unknown[] = [];
    let parameterIndex = 1;

    const addChange = (column: string, value: unknown) => {
      assignments.push(`${column} = $${parameterIndex}`);
      values.push(value);
      parameterIndex += 1;
    };

    if (changes.status !== undefined) addChange("status", changes.status);
    if (changes.pageToken !== undefined) addChange("page_token", changes.pageToken);
    if (changes.messagesDiscovered !== undefined) {
      assertNonNegative(changes.messagesDiscovered, "messagesDiscovered");
      addChange("messages_discovered", changes.messagesDiscovered);
    }
    if (changes.messagesProcessed !== undefined) {
      assertNonNegative(changes.messagesProcessed, "messagesProcessed");
      addChange("messages_processed", changes.messagesProcessed);
    }
    if (changes.transactionsExtracted !== undefined) {
      assertNonNegative(changes.transactionsExtracted, "transactionsExtracted");
      addChange("transactions_extracted", changes.transactionsExtracted);
    }
    if (changes.messagesSkipped !== undefined) {
      assertNonNegative(changes.messagesSkipped, "messagesSkipped");
      addChange("messages_skipped", changes.messagesSkipped);
    }
    if (changes.errorMessage !== undefined) addChange("error_message", changes.errorMessage);
    if (changes.startedAt !== undefined) addChange("started_at", changes.startedAt);
    if (changes.completedAt !== undefined) addChange("completed_at", changes.completedAt);

    if (assignments.length === 0) throw new Error("At least one import job change is required.");

    assignments.push(`updated_at = $${parameterIndex}`);
    values.push(new Date().toISOString());
    parameterIndex += 1;
    values.push(jobId, googleSubject);
    const result = await this.pool.query(
      `UPDATE gmail_import_jobs
       SET ${assignments.join(", ")}
       WHERE job_id = $${parameterIndex} AND google_subject = $${parameterIndex + 1}`,
      values,
    );

    return result.rowCount === 0 ? null : this.get(jobId, googleSubject);
  }

  async close() {
    if (this.ownsPool) await this.pool.end();
  }
}

export async function createImportJobStore(
  connection?: DatabaseConnection,
): Promise<ImportJobStore> {
  const ownsConnection = !connection;
  const activeConnection = connection ?? createDatabaseConnection();

  if (activeConnection.dialect === "postgres") {
    return new PostgresImportJobStore(activeConnection.pool, ownsConnection);
  }

  return new SqliteImportJobStore(activeConnection.database, ownsConnection);
}
