import { randomUUID } from "node:crypto";
import type { NormalizedTransaction } from "@account-manager/shared";
import { createDatabaseConnection, type DatabaseConnection } from "../database.js";
import { createSqliteDatabase, type SqliteDatabase } from "../sqlite.js";
import type { PostgresPool } from "../postgres.js";
import { buildTransactionFingerprint } from "../../import/transactionFingerprint.js";

export type NormalizedTransactionWrite = {
  googleSubject: string;
  bankId: string;
  transaction: NormalizedTransaction;
};

export type NormalizedTransactionUpdate = {
  direction?: NormalizedTransaction["direction"];
  transactionDate?: NormalizedTransaction["transactionDate"];
  transactionTime?: NormalizedTransaction["transactionTime"];
  amount?: NormalizedTransaction["amount"];
  counterparty?: NormalizedTransaction["counterparty"];
  description?: NormalizedTransaction["description"];
  reviewStatus?: NormalizedTransaction["reviewStatus"];
};

export type StoredNormalizedTransaction = NormalizedTransaction & {
  id: string;
  googleSubject: string;
  bankId: string;
  createdAt: string;
  updatedAt: string;
};

export interface TransactionStore {
  upsert(input: NormalizedTransactionWrite): Promise<StoredNormalizedTransaction>;
  update(
    googleSubject: string,
    bankId: string,
    transactionId: string,
    changes: NormalizedTransactionUpdate,
  ): Promise<StoredNormalizedTransaction | null>;
  get(
    googleSubject: string,
    bankId: string,
    sourceMessageId: string,
  ): Promise<StoredNormalizedTransaction | null>;
  findByFingerprint(
    googleSubject: string,
    bankId: string,
    fingerprint: string,
  ): Promise<StoredNormalizedTransaction | null>;
  list(googleSubject: string, bankId: string): Promise<StoredNormalizedTransaction[]>;
  listForImportJob(
    googleSubject: string,
    bankId: string,
    jobId: string,
  ): Promise<StoredNormalizedTransaction[]>;
  close(): Promise<void>;
}

type TransactionRow = {
  transaction_id: string;
  google_subject: string;
  bank_id: string;
  source_message_id: string;
  fingerprint: string;
  transaction_date: string | null;
  transaction_time: string | null;
  direction: "debit" | "credit" | null;
  amount: string | null;
  currency: string | null;
  counterparty: string | null;
  description: string | null;
  channel: string | null;
  confidence: "high" | "medium" | "low";
  review_reasons_json: string;
  review_status: "ready" | "needs-review" | "dismissed";
  created_at: string;
  updated_at: string;
};

function assertIdentifier(value: string, field: string) {
  if (!value.trim()) throw new Error(`${field} must not be empty.`);
}

function toStoredTransaction(row: TransactionRow): StoredNormalizedTransaction {
  return {
    id: row.transaction_id,
    googleSubject: row.google_subject,
    bankId: row.bank_id,
    sourceMessageId: row.source_message_id,
    transactionDate: row.transaction_date,
    transactionTime: row.transaction_time,
    direction: row.direction,
    amount: row.amount,
    currency: row.currency,
    counterparty: row.counterparty,
    description: row.description,
    channel: row.channel,
    confidence: row.confidence,
    reviewReasons: JSON.parse(row.review_reasons_json) as string[],
    reviewStatus: row.review_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getColumns(tableAlias?: string) {
  const prefix = tableAlias ? `${tableAlias}.` : "";
  return `
    ${prefix}transaction_id, ${prefix}google_subject, ${prefix}bank_id, ${prefix}source_message_id,
    ${prefix}fingerprint,
    ${prefix}transaction_date, ${prefix}transaction_time, ${prefix}direction, ${prefix}amount, ${prefix}currency, ${prefix}counterparty, ${prefix}description, ${prefix}channel,
    ${prefix}confidence, ${prefix}review_reasons_json, ${prefix}review_status,
    ${prefix}created_at, ${prefix}updated_at`;
}

function getValues(input: NormalizedTransactionWrite, transactionId: string, timestamp: string) {
  return [
    transactionId,
    input.googleSubject,
    input.bankId,
    input.transaction.sourceMessageId,
    buildTransactionFingerprint(input.transaction),
    input.transaction.transactionDate,
    input.transaction.transactionTime,
    input.transaction.direction,
    input.transaction.amount,
    input.transaction.currency,
    input.transaction.counterparty,
    input.transaction.description,
    input.transaction.channel,
    input.transaction.confidence,
    JSON.stringify(input.transaction.reviewReasons),
    input.transaction.reviewStatus,
    timestamp,
    timestamp,
  ];
}

function validateInput(input: NormalizedTransactionWrite) {
  assertIdentifier(input.googleSubject, "googleSubject");
  assertIdentifier(input.bankId, "bankId");
  assertIdentifier(input.transaction.sourceMessageId, "sourceMessageId");
}

function assertValidTransactionUpdate(
  googleSubject: string,
  bankId: string,
  transactionId: string,
  changes: NormalizedTransactionUpdate,
) {
  assertIdentifier(googleSubject, "googleSubject");
  assertIdentifier(bankId, "bankId");
  assertIdentifier(transactionId, "transactionId");
  if (
    changes.direction === undefined &&
    changes.transactionDate === undefined &&
    changes.transactionTime === undefined &&
    changes.amount === undefined &&
    changes.counterparty === undefined &&
    changes.description === undefined &&
    changes.reviewStatus === undefined
  ) {
    throw new Error("At least one transaction field must be provided.");
  }
}

function applyUpdate(
  transaction: StoredNormalizedTransaction,
  changes: NormalizedTransactionUpdate,
) {
  return {
    ...transaction,
    direction: changes.direction !== undefined ? changes.direction : transaction.direction,
    transactionDate:
      changes.transactionDate !== undefined ? changes.transactionDate : transaction.transactionDate,
    transactionTime:
      changes.transactionTime !== undefined ? changes.transactionTime : transaction.transactionTime,
    amount: changes.amount !== undefined ? changes.amount : transaction.amount,
    counterparty:
      changes.counterparty !== undefined ? changes.counterparty : transaction.counterparty,
    description: changes.description !== undefined ? changes.description : transaction.description,
    reviewStatus:
      changes.reviewStatus !== undefined ? changes.reviewStatus : transaction.reviewStatus,
  };
}

export class SqliteTransactionStore implements TransactionStore {
  constructor(
    private readonly database: SqliteDatabase = createSqliteDatabase(),
    private readonly ownsDatabase = true,
  ) {}

  async upsert(input: NormalizedTransactionWrite) {
    validateInput(input);
    const transactionId = randomUUID();
    const now = new Date().toISOString();

    this.database
      .prepare(
        `INSERT INTO normalized_transactions
          (${getColumns()})
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(google_subject, bank_id, source_message_id) DO UPDATE SET
           transaction_date = excluded.transaction_date,
           transaction_time = excluded.transaction_time,
           direction = excluded.direction,
           amount = excluded.amount,
           currency = excluded.currency,
           counterparty = excluded.counterparty,
           description = excluded.description,
           channel = excluded.channel,
           confidence = excluded.confidence,
           review_reasons_json = excluded.review_reasons_json,
           review_status = excluded.review_status,
           fingerprint = excluded.fingerprint,
           updated_at = excluded.updated_at`,
      )
      .run(...getValues(input, transactionId, now));

    return (await this.get(
      input.googleSubject,
      input.bankId,
      input.transaction.sourceMessageId,
    )) as StoredNormalizedTransaction;
  }

  async update(
    googleSubject: string,
    bankId: string,
    transactionId: string,
    changes: NormalizedTransactionUpdate,
  ) {
    assertValidTransactionUpdate(googleSubject, bankId, transactionId, changes);

    const row = this.database
      .prepare(
        `SELECT ${getColumns()}
         FROM normalized_transactions
         WHERE transaction_id = ? AND google_subject = ? AND bank_id = ?`,
      )
      .get(transactionId, googleSubject, bankId) as TransactionRow | undefined;

    if (!row) return null;

    const current = toStoredTransaction(row);
    const updated = applyUpdate(current, changes);
    const now = new Date().toISOString();
    const fingerprint = buildTransactionFingerprint(updated);

    this.database
      .prepare(
        `UPDATE normalized_transactions
         SET transaction_date = ?, transaction_time = ?, direction = ?, amount = ?, counterparty = ?, description = ?,
             review_status = ?, fingerprint = ?, updated_at = ?
         WHERE transaction_id = ? AND google_subject = ? AND bank_id = ?`,
      )
      .run(
        updated.transactionDate,
        updated.transactionTime,
        updated.direction,
        updated.amount,
        updated.counterparty,
        updated.description,
        updated.reviewStatus,
        fingerprint,
        now,
        transactionId,
        googleSubject,
        bankId,
      );

    return { ...updated, updatedAt: now };
  }

  async get(googleSubject: string, bankId: string, sourceMessageId: string) {
    assertIdentifier(googleSubject, "googleSubject");
    assertIdentifier(bankId, "bankId");
    assertIdentifier(sourceMessageId, "sourceMessageId");

    const row = this.database
      .prepare(
        `SELECT ${getColumns()}
         FROM normalized_transactions
         WHERE google_subject = ? AND bank_id = ? AND source_message_id = ?`,
      )
      .get(googleSubject, bankId, sourceMessageId) as TransactionRow | undefined;

    return row ? toStoredTransaction(row) : null;
  }

  async findByFingerprint(googleSubject: string, bankId: string, fingerprint: string) {
    assertIdentifier(googleSubject, "googleSubject");
    assertIdentifier(bankId, "bankId");
    assertIdentifier(fingerprint, "fingerprint");

    const row = this.database
      .prepare(
        `SELECT ${getColumns()}
         FROM normalized_transactions
         WHERE google_subject = ? AND bank_id = ? AND fingerprint = ?
         ORDER BY transaction_id
         LIMIT 1`,
      )
      .get(googleSubject, bankId, fingerprint) as TransactionRow | undefined;

    return row ? toStoredTransaction(row) : null;
  }

  async list(googleSubject: string, bankId: string) {
    assertIdentifier(googleSubject, "googleSubject");
    assertIdentifier(bankId, "bankId");

    const rows = this.database
      .prepare(
        `SELECT ${getColumns()}
         FROM normalized_transactions
         WHERE google_subject = ? AND bank_id = ?
         ORDER BY transaction_date, transaction_id`,
      )
      .all(googleSubject, bankId) as TransactionRow[];

    return rows.map(toStoredTransaction);
  }

  async listForImportJob(googleSubject: string, bankId: string, jobId: string) {
    assertIdentifier(googleSubject, "googleSubject");
    assertIdentifier(bankId, "bankId");
    assertIdentifier(jobId, "jobId");

    const rows = this.database
      .prepare(
        `SELECT ${getColumns("transactions")}
         FROM normalized_transactions AS transactions
         INNER JOIN gmail_import_job_transactions AS links
           ON links.transaction_id = transactions.transaction_id
          AND links.google_subject = transactions.google_subject
          AND links.bank_id = transactions.bank_id
         WHERE links.google_subject = ? AND links.bank_id = ? AND links.job_id = ?
         ORDER BY transactions.transaction_date, transactions.transaction_id`,
      )
      .all(googleSubject, bankId, jobId) as TransactionRow[];

    return rows.map(toStoredTransaction);
  }

  async close() {
    if (this.ownsDatabase) this.database.close();
  }
}

export class PostgresTransactionStore implements TransactionStore {
  constructor(
    private readonly pool: PostgresPool,
    private readonly ownsPool = true,
  ) {}

  async upsert(input: NormalizedTransactionWrite) {
    validateInput(input);
    const transactionId = randomUUID();
    const now = new Date().toISOString();
    const result = await this.pool.query<TransactionRow>(
      `INSERT INTO normalized_transactions
        (${getColumns()})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       ON CONFLICT (google_subject, bank_id, source_message_id) DO UPDATE SET
         transaction_date = EXCLUDED.transaction_date,
         transaction_time = EXCLUDED.transaction_time,
         direction = EXCLUDED.direction,
         amount = EXCLUDED.amount,
         currency = EXCLUDED.currency,
         counterparty = EXCLUDED.counterparty,
         description = EXCLUDED.description,
         channel = EXCLUDED.channel,
         confidence = EXCLUDED.confidence,
         review_reasons_json = EXCLUDED.review_reasons_json,
         review_status = EXCLUDED.review_status,
         fingerprint = EXCLUDED.fingerprint,
         updated_at = EXCLUDED.updated_at
       RETURNING ${getColumns()}`,
      getValues(input, transactionId, now),
    );

    return toStoredTransaction(result.rows[0]);
  }

  async update(
    googleSubject: string,
    bankId: string,
    transactionId: string,
    changes: NormalizedTransactionUpdate,
  ) {
    assertValidTransactionUpdate(googleSubject, bankId, transactionId, changes);

    const currentResult = await this.pool.query<TransactionRow>(
      `SELECT ${getColumns()}
       FROM normalized_transactions
       WHERE transaction_id = $1 AND google_subject = $2 AND bank_id = $3`,
      [transactionId, googleSubject, bankId],
    );

    if (!currentResult.rows[0]) return null;

    const current = toStoredTransaction(currentResult.rows[0]);
    const updated = applyUpdate(current, changes);
    const now = new Date().toISOString();
    const fingerprint = buildTransactionFingerprint(updated);
    const result = await this.pool.query<TransactionRow>(
      `UPDATE normalized_transactions
       SET transaction_date = $1, transaction_time = $2, direction = $3, amount = $4, counterparty = $5, description = $6,
           review_status = $7, fingerprint = $8, updated_at = $9
       WHERE transaction_id = $10 AND google_subject = $11 AND bank_id = $12
       RETURNING ${getColumns()}`,
      [
        updated.transactionDate,
        updated.transactionTime,
        updated.direction,
        updated.amount,
        updated.counterparty,
        updated.description,
        updated.reviewStatus,
        fingerprint,
        now,
        transactionId,
        googleSubject,
        bankId,
      ],
    );

    return result.rows[0] ? toStoredTransaction(result.rows[0]) : null;
  }

  async get(googleSubject: string, bankId: string, sourceMessageId: string) {
    assertIdentifier(googleSubject, "googleSubject");
    assertIdentifier(bankId, "bankId");
    assertIdentifier(sourceMessageId, "sourceMessageId");

    const result = await this.pool.query<TransactionRow>(
      `SELECT ${getColumns()}
       FROM normalized_transactions
       WHERE google_subject = $1 AND bank_id = $2 AND source_message_id = $3`,
      [googleSubject, bankId, sourceMessageId],
    );

    return result.rows[0] ? toStoredTransaction(result.rows[0]) : null;
  }

  async findByFingerprint(googleSubject: string, bankId: string, fingerprint: string) {
    assertIdentifier(googleSubject, "googleSubject");
    assertIdentifier(bankId, "bankId");
    assertIdentifier(fingerprint, "fingerprint");

    const result = await this.pool.query<TransactionRow>(
      `SELECT ${getColumns()}
       FROM normalized_transactions
       WHERE google_subject = $1 AND bank_id = $2 AND fingerprint = $3
       ORDER BY transaction_id
       LIMIT 1`,
      [googleSubject, bankId, fingerprint],
    );

    return result.rows[0] ? toStoredTransaction(result.rows[0]) : null;
  }

  async list(googleSubject: string, bankId: string) {
    assertIdentifier(googleSubject, "googleSubject");
    assertIdentifier(bankId, "bankId");

    const result = await this.pool.query<TransactionRow>(
      `SELECT ${getColumns()}
       FROM normalized_transactions
       WHERE google_subject = $1 AND bank_id = $2
       ORDER BY transaction_date, transaction_id`,
      [googleSubject, bankId],
    );

    return result.rows.map(toStoredTransaction);
  }

  async listForImportJob(googleSubject: string, bankId: string, jobId: string) {
    assertIdentifier(googleSubject, "googleSubject");
    assertIdentifier(bankId, "bankId");
    assertIdentifier(jobId, "jobId");

    const result = await this.pool.query<TransactionRow>(
      `SELECT ${getColumns("transactions")}
       FROM normalized_transactions AS transactions
       INNER JOIN gmail_import_job_transactions AS links
         ON links.transaction_id = transactions.transaction_id
        AND links.google_subject = transactions.google_subject
        AND links.bank_id = transactions.bank_id
       WHERE links.google_subject = $1 AND links.bank_id = $2 AND links.job_id = $3
       ORDER BY transactions.transaction_date, transactions.transaction_id`,
      [googleSubject, bankId, jobId],
    );

    return result.rows.map(toStoredTransaction);
  }

  async close() {
    if (this.ownsPool) await this.pool.end();
  }
}

export async function createTransactionStore(
  connection?: DatabaseConnection,
): Promise<TransactionStore> {
  const ownsConnection = !connection;
  const activeConnection = connection ?? createDatabaseConnection();

  if (activeConnection.dialect === "postgres") {
    return new PostgresTransactionStore(activeConnection.pool, ownsConnection);
  }

  return new SqliteTransactionStore(activeConnection.database, ownsConnection);
}
