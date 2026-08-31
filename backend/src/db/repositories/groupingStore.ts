import { randomUUID } from "node:crypto";
import type { TransactionGroup, TransactionGroupMembership } from "@account-manager/shared";
import { createDatabaseConnection, type DatabaseConnection } from "../database.js";
import { createSqliteDatabase, type SqliteDatabase } from "../sqlite.js";
import type { PostgresPool } from "../postgres.js";

const maxGroupNameLength = 80;

type GroupRow = {
  group_id: string;
  google_subject: string;
  bank_id: string;
  name: string;
  transaction_count: number | string;
  created_at: string;
  updated_at: string;
};

type MembershipRow = {
  transaction_id: string;
  group_id: string;
  google_subject: string;
  bank_id: string;
  assignment_source: "manual";
  created_at: string;
  updated_at: string;
};

export type TransactionGroupWrite = {
  googleSubject: string;
  bankId: string;
  name: string;
};

export interface GroupingStore {
  create(input: TransactionGroupWrite): Promise<TransactionGroup>;
  list(googleSubject: string, bankId: string): Promise<TransactionGroup[]>;
  rename(
    googleSubject: string,
    bankId: string,
    groupId: string,
    name: string,
  ): Promise<TransactionGroup | null>;
  delete(googleSubject: string, bankId: string, groupId: string): Promise<boolean>;
  assign(
    googleSubject: string,
    bankId: string,
    groupId: string,
    transactionId: string,
  ): Promise<TransactionGroupMembership | null>;
  unassign(
    googleSubject: string,
    bankId: string,
    transactionId: string,
  ): Promise<boolean>;
  listMemberships(
    googleSubject: string,
    bankId: string,
  ): Promise<TransactionGroupMembership[]>;
  close(): Promise<void>;
}

function assertIdentifier(value: string, field: string) {
  if (!value.trim()) throw new Error(`${field} must not be empty.`);
}

function normalizeGroupName(name: string) {
  const normalized = name.trim();
  if (!normalized) throw new Error("Group name must not be empty.");
  if (normalized.length > maxGroupNameLength) {
    throw new Error(`Group name must be ${maxGroupNameLength} characters or fewer.`);
  }
  return normalized;
}

function validateScope(googleSubject: string, bankId: string) {
  assertIdentifier(googleSubject, "googleSubject");
  assertIdentifier(bankId, "bankId");
}

function toGroup(row: GroupRow): TransactionGroup {
  return {
    id: row.group_id,
    name: row.name,
    googleSubject: row.google_subject,
    bankId: row.bank_id,
    transactionCount: Number(row.transaction_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMembership(row: MembershipRow): TransactionGroupMembership {
  return {
    transactionId: row.transaction_id,
    groupId: row.group_id,
    googleSubject: row.google_subject,
    bankId: row.bank_id,
    assignmentSource: row.assignment_source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const groupColumns = `
  groups.group_id, groups.google_subject, groups.bank_id, groups.name,
  COUNT(memberships.transaction_id) AS transaction_count,
  groups.created_at, groups.updated_at`;

const membershipColumns = `
  transaction_id, group_id, google_subject, bank_id, assignment_source, created_at, updated_at`;

function duplicateNameError() {
  return new Error("A group with that name already exists for this bank.");
}

class SqliteGroupingStore implements GroupingStore {
  constructor(
    private readonly database: SqliteDatabase = createSqliteDatabase(),
    private readonly ownsDatabase = true,
  ) {}

  async create(input: TransactionGroupWrite) {
    validateScope(input.googleSubject, input.bankId);
    const name = normalizeGroupName(input.name);
    const now = new Date().toISOString();
    const id = randomUUID();

    try {
      this.database
        .prepare(
          `INSERT INTO transaction_groups
            (group_id, google_subject, bank_id, name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(id, input.googleSubject, input.bankId, name, now, now);
    } catch (error) {
      if (error instanceof Error && error.message.includes("transaction_groups")) {
        throw duplicateNameError();
      }
      throw error;
    }

    return (await this.get(id, input.googleSubject, input.bankId)) as TransactionGroup;
  }

  private async get(groupId: string, googleSubject: string, bankId: string) {
    const row = this.database
      .prepare(
        `SELECT ${groupColumns}
         FROM transaction_groups AS groups
         LEFT JOIN transaction_group_memberships AS memberships
           ON memberships.group_id = groups.group_id
          AND memberships.google_subject = groups.google_subject
          AND memberships.bank_id = groups.bank_id
         WHERE groups.group_id = ? AND groups.google_subject = ? AND groups.bank_id = ?
         GROUP BY groups.group_id`,
      )
      .get(groupId, googleSubject, bankId) as GroupRow | undefined;
    return row ? toGroup(row) : null;
  }

  async list(googleSubject: string, bankId: string) {
    validateScope(googleSubject, bankId);
    const rows = this.database
      .prepare(
        `SELECT ${groupColumns}
         FROM transaction_groups AS groups
         LEFT JOIN transaction_group_memberships AS memberships
           ON memberships.group_id = groups.group_id
          AND memberships.google_subject = groups.google_subject
          AND memberships.bank_id = groups.bank_id
         WHERE groups.google_subject = ? AND groups.bank_id = ?
         GROUP BY groups.group_id
         ORDER BY groups.name COLLATE NOCASE, groups.group_id`,
      )
      .all(googleSubject, bankId) as GroupRow[];
    return rows.map(toGroup);
  }

  async rename(googleSubject: string, bankId: string, groupId: string, name: string) {
    validateScope(googleSubject, bankId);
    assertIdentifier(groupId, "groupId");
    const normalizedName = normalizeGroupName(name);
    try {
      const result = this.database
        .prepare(
          `UPDATE transaction_groups
           SET name = ?, updated_at = ?
           WHERE group_id = ? AND google_subject = ? AND bank_id = ?`,
        )
        .run(normalizedName, new Date().toISOString(), groupId, googleSubject, bankId);
      if (result.changes === 0) return null;
    } catch (error) {
      if (error instanceof Error && error.message.includes("transaction_groups")) {
        throw duplicateNameError();
      }
      throw error;
    }
    return this.get(groupId, googleSubject, bankId);
  }

  async delete(googleSubject: string, bankId: string, groupId: string) {
    validateScope(googleSubject, bankId);
    assertIdentifier(groupId, "groupId");
    const result = this.database
      .prepare(
        `DELETE FROM transaction_groups
         WHERE group_id = ? AND google_subject = ? AND bank_id = ?`,
      )
      .run(groupId, googleSubject, bankId);
    return result.changes > 0;
  }

  async assign(googleSubject: string, bankId: string, groupId: string, transactionId: string) {
    validateScope(googleSubject, bankId);
    assertIdentifier(groupId, "groupId");
    assertIdentifier(transactionId, "transactionId");
    const group = this.database
      .prepare(
        `SELECT group_id FROM transaction_groups
         WHERE group_id = ? AND google_subject = ? AND bank_id = ?`,
      )
      .get(groupId, googleSubject, bankId);
    if (!group) return null;
    const transaction = this.database
      .prepare(
        `SELECT transaction_id FROM normalized_transactions
         WHERE transaction_id = ? AND google_subject = ? AND bank_id = ?`,
      )
      .get(transactionId, googleSubject, bankId);
    if (!transaction) return null;
    const now = new Date().toISOString();
    this.database
      .prepare(
        `INSERT INTO transaction_group_memberships
          (transaction_id, group_id, google_subject, bank_id, assignment_source, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'manual', ?, ?)
         ON CONFLICT(transaction_id) DO UPDATE SET
           group_id = excluded.group_id,
           google_subject = excluded.google_subject,
           bank_id = excluded.bank_id,
           assignment_source = excluded.assignment_source,
           updated_at = excluded.updated_at`,
      )
      .run(transactionId, groupId, googleSubject, bankId, now, now);
    const row = this.database
      .prepare(`SELECT ${membershipColumns} FROM transaction_group_memberships WHERE transaction_id = ?`)
      .get(transactionId) as MembershipRow;
    return toMembership(row);
  }

  async unassign(googleSubject: string, bankId: string, transactionId: string) {
    validateScope(googleSubject, bankId);
    assertIdentifier(transactionId, "transactionId");
    const result = this.database
      .prepare(
        `DELETE FROM transaction_group_memberships
         WHERE transaction_id = ? AND google_subject = ? AND bank_id = ?`,
      )
      .run(transactionId, googleSubject, bankId);
    return result.changes > 0;
  }

  async listMemberships(googleSubject: string, bankId: string) {
    validateScope(googleSubject, bankId);
    const rows = this.database
      .prepare(
        `SELECT ${membershipColumns}
         FROM transaction_group_memberships
         WHERE google_subject = ? AND bank_id = ?
         ORDER BY transaction_id`,
      )
      .all(googleSubject, bankId) as MembershipRow[];
    return rows.map(toMembership);
  }

  async close() {
    if (this.ownsDatabase) this.database.close();
  }
}

class PostgresGroupingStore implements GroupingStore {
  constructor(
    private readonly pool: PostgresPool,
    private readonly ownsPool = true,
  ) {}

  async create(input: TransactionGroupWrite) {
    validateScope(input.googleSubject, input.bankId);
    const name = normalizeGroupName(input.name);
    const id = randomUUID();
    const now = new Date().toISOString();
    try {
      await this.pool.query(
        `INSERT INTO transaction_groups
          (group_id, google_subject, bank_id, name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)`,
        [id, input.googleSubject, input.bankId, name, now],
      );
    } catch (error) {
      if (error instanceof Error && "constraint" in error && error.constraint === "transaction_groups_user_bank_name_idx") {
        throw duplicateNameError();
      }
      throw error;
    }
    return (await this.get(id, input.googleSubject, input.bankId)) as TransactionGroup;
  }

  private async get(groupId: string, googleSubject: string, bankId: string) {
    const result = await this.pool.query<GroupRow>(
      `SELECT ${groupColumns}
       FROM transaction_groups AS groups
       LEFT JOIN transaction_group_memberships AS memberships
         ON memberships.group_id = groups.group_id
        AND memberships.google_subject = groups.google_subject
        AND memberships.bank_id = groups.bank_id
       WHERE groups.group_id = $1 AND groups.google_subject = $2 AND groups.bank_id = $3
       GROUP BY groups.group_id`,
      [groupId, googleSubject, bankId],
    );
    return result.rows[0] ? toGroup(result.rows[0]) : null;
  }

  async list(googleSubject: string, bankId: string) {
    validateScope(googleSubject, bankId);
    const result = await this.pool.query<GroupRow>(
      `SELECT ${groupColumns}
       FROM transaction_groups AS groups
       LEFT JOIN transaction_group_memberships AS memberships
         ON memberships.group_id = groups.group_id
        AND memberships.google_subject = groups.google_subject
        AND memberships.bank_id = groups.bank_id
       WHERE groups.google_subject = $1 AND groups.bank_id = $2
       GROUP BY groups.group_id
       ORDER BY groups.name, groups.group_id`,
      [googleSubject, bankId],
    );
    return result.rows.map(toGroup);
  }

  async rename(googleSubject: string, bankId: string, groupId: string, name: string) {
    validateScope(googleSubject, bankId);
    assertIdentifier(groupId, "groupId");
    const normalizedName = normalizeGroupName(name);
    const result = await this.pool.query(
      `UPDATE transaction_groups
       SET name = $1, updated_at = $2
       WHERE group_id = $3 AND google_subject = $4 AND bank_id = $5`,
      [normalizedName, new Date().toISOString(), groupId, googleSubject, bankId],
    );
    if (result.rowCount === 0) return null;
    return this.get(groupId, googleSubject, bankId);
  }

  async delete(googleSubject: string, bankId: string, groupId: string) {
    validateScope(googleSubject, bankId);
    assertIdentifier(groupId, "groupId");
    const result = await this.pool.query(
      `DELETE FROM transaction_groups
       WHERE group_id = $1 AND google_subject = $2 AND bank_id = $3`,
      [groupId, googleSubject, bankId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async assign(googleSubject: string, bankId: string, groupId: string, transactionId: string) {
    validateScope(googleSubject, bankId);
    assertIdentifier(groupId, "groupId");
    assertIdentifier(transactionId, "transactionId");
    const result = await this.pool.query(
      `INSERT INTO transaction_group_memberships
        (transaction_id, group_id, google_subject, bank_id, assignment_source, created_at, updated_at)
       SELECT $1, groups.group_id, groups.google_subject, groups.bank_id, 'manual', $4, $4
       FROM transaction_groups AS groups
       INNER JOIN normalized_transactions AS transactions
         ON transactions.google_subject = groups.google_subject AND transactions.bank_id = groups.bank_id
        AND transactions.transaction_id = $1
       WHERE groups.group_id = $2 AND groups.google_subject = $3 AND groups.bank_id = $5
       ON CONFLICT (transaction_id) DO UPDATE SET
         group_id = EXCLUDED.group_id,
         google_subject = EXCLUDED.google_subject,
         bank_id = EXCLUDED.bank_id,
         assignment_source = EXCLUDED.assignment_source,
         updated_at = EXCLUDED.updated_at
       RETURNING ${membershipColumns}`,
      [transactionId, groupId, googleSubject, new Date().toISOString(), bankId],
    );
    return result.rows[0] ? toMembership(result.rows[0] as MembershipRow) : null;
  }

  async unassign(googleSubject: string, bankId: string, transactionId: string) {
    validateScope(googleSubject, bankId);
    assertIdentifier(transactionId, "transactionId");
    const result = await this.pool.query(
      `DELETE FROM transaction_group_memberships
       WHERE transaction_id = $1 AND google_subject = $2 AND bank_id = $3`,
      [transactionId, googleSubject, bankId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listMemberships(googleSubject: string, bankId: string) {
    validateScope(googleSubject, bankId);
    const result = await this.pool.query<MembershipRow>(
      `SELECT ${membershipColumns}
       FROM transaction_group_memberships
       WHERE google_subject = $1 AND bank_id = $2
       ORDER BY transaction_id`,
      [googleSubject, bankId],
    );
    return result.rows.map(toMembership);
  }

  async close() {
    if (this.ownsPool) await this.pool.end();
  }
}

export async function createGroupingStore(connection?: DatabaseConnection): Promise<GroupingStore> {
  const ownsConnection = !connection;
  const activeConnection = connection ?? createDatabaseConnection();
  if (activeConnection.dialect === "postgres") {
    return new PostgresGroupingStore(activeConnection.pool, ownsConnection);
  }
  return new SqliteGroupingStore(activeConnection.database, ownsConnection);
}

export { SqliteGroupingStore, PostgresGroupingStore };
