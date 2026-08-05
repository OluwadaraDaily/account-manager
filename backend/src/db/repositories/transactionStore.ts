import { randomUUID } from "node:crypto";
import type { NormalizedTransaction } from "@account-manager/shared";
import { createDatabaseConnection, type DatabaseConnection } from "../database.js";
import { createSqliteDatabase, type SqliteDatabase } from "../sqlite.js";
import type { PostgresPool } from "../postgres.js";

export type NormalizedTransactionWrite = {
  googleSubject: string;
  bankId: string;
  transaction: NormalizedTransaction;
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
  get(
    googleSubject: string,
    bankId: string,
    sourceMessageId: string,
  ): Promise<StoredNormalizedTransaction | null>;
  list(googleSubject: string, bankId: string): Promise<StoredNormalizedTransaction[]>;
  close(): Promise<void>;
}

type TransactionRow = {
  transaction_id: string;
  google_subject: string;
  bank_id: string;
  source_message_id: string;
  transaction_date: string | null;
  direction: "debit" | "credit" | null;
  amount: string | null;
  currency: string | null;
  counterparty: string | null;
  description: string | null;
  channel: string | null;
  confidence: "high" | "medium" | "low";
  review_reasons_json: string;
  review_status: "ready" | "needs-review";
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

function getColumns() {
  return `
    transaction_id, google_subject, bank_id, source_message_id,
    transaction_date, direction, amount, currency, counterparty, description, channel,
    confidence, review_reasons_json, review_status,
    created_at, updated_at`;
}

function getValues(input: NormalizedTransactionWrite, transactionId: string, timestamp: string) {
  return [
    transactionId,
    input.googleSubject,
    input.bankId,
    input.transaction.sourceMessageId,
    input.transaction.transactionDate,
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
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(google_subject, bank_id, source_message_id) DO UPDATE SET
           transaction_date = excluded.transaction_date,
           direction = excluded.direction,
           amount = excluded.amount,
           currency = excluded.currency,
           counterparty = excluded.counterparty,
           description = excluded.description,
           channel = excluded.channel,
           confidence = excluded.confidence,
           review_reasons_json = excluded.review_reasons_json,
           review_status = excluded.review_status,
           updated_at = excluded.updated_at`,
      )
      .run(...getValues(input, transactionId, now));

    return (await this.get(
      input.googleSubject,
      input.bankId,
      input.transaction.sourceMessageId,
    )) as StoredNormalizedTransaction;
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
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (google_subject, bank_id, source_message_id) DO UPDATE SET
         transaction_date = EXCLUDED.transaction_date,
         direction = EXCLUDED.direction,
         amount = EXCLUDED.amount,
         currency = EXCLUDED.currency,
         counterparty = EXCLUDED.counterparty,
         description = EXCLUDED.description,
         channel = EXCLUDED.channel,
         confidence = EXCLUDED.confidence,
         review_reasons_json = EXCLUDED.review_reasons_json,
         review_status = EXCLUDED.review_status,
         updated_at = EXCLUDED.updated_at
       RETURNING ${getColumns()}`,
      getValues(input, transactionId, now),
    );

    return toStoredTransaction(result.rows[0]);
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
